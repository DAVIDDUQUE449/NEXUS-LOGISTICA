import { HOME_KPIS, evaluateTripRisk, STALE_POSITION_MINUTES } from '@nexus/domain-core';
import type { DbService } from '../db/db.service';
import type { RequestCtx } from '../auth/auth-context';
import { toSnapshot, type TripRow } from '../operations/trip.repo';

const ACTIVE = `status NOT IN ('DELIVERED','CANCELLED','RETURN_TO_SENDER')`;

/**
 * Datos de la pantalla de inicio (N.02). Todo se calcula desde las tablas transaccionales del tenant
 * y del alcance de sedes del usuario; nada se inventa. Cada KPI incluye su definición.
 */
export class DashboardService {
  constructor(private readonly db: DbService) {}

  async summary(ctx: RequestCtx) {
    const now = new Date();
    return this.db.withTenant(ctx.tenant, async (tx) => {
      const scope: unknown[] = [ctx.siteId, [...ctx.subject.siteIds]]; // $1 sede activa, $2 alcance
      const siteFilter = (col: string) => `($1::uuid IS NULL OR ${col} = $1) AND (cardinality($2::uuid[]) = 0 OR ${col} = ANY($2))`;

      const k = (await tx.query(
        `SELECT
           count(*) FILTER (WHERE ${ACTIVE})::int AS active_shipments,
           coalesce(sum(units) FILTER (WHERE status IN ('LINEHAUL_IN_TRANSIT','OUT_FOR_DELIVERY')), 0)::int AS units_in_transit,
           count(*) FILTER (WHERE status = 'DELIVERED' AND (delivered_at AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date)::int AS delivered_today,
           count(*) FILTER (WHERE ${ACTIVE} AND promised_by < now())::int AS delayed,
           count(*) FILTER (WHERE ${ACTIVE} AND at_risk AND promised_by >= now())::int AS at_risk,
           count(*) FILTER (WHERE (promised_by AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date OR
                                  (status = 'DELIVERED' AND (delivered_at AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date))::int AS due_today
         FROM parcel.shipment WHERE ${siteFilter('origin_site_id')}`, scope)).rows[0];
      const openEx = (await tx.query(
        `SELECT count(*)::int AS n FROM parcel.exception_case WHERE status IN ('open','acknowledged','in_progress') AND ${siteFilter('site_id')}`, scope)).rows[0].n as number;
      const lastEvent = (await tx.query('SELECT max(recorded_at) AS at FROM core.domain_event')).rows[0].at as Date | null;

      const denominators: Record<string, number | null> = {
        active_shipments: null, units_in_transit: null, delivered_today: k.due_today, delayed: k.active_shipments, at_risk: k.active_shipments, open_exceptions: null,
      };
      const values: Record<string, number> = { ...k, open_exceptions: openEx };
      const kpis = HOME_KPIS.map((d) => ({
        code: d.code, label: d.label, value: values[d.code] ?? 0, denominator: denominators[d.code] ?? null, trend: null,
        source: d.code === 'open_exceptions' ? 'parcel.exception_case' : 'parcel.shipment', definition: d, updatedAt: now,
      }));

      const trips = (await tx.query<TripRow & { vehicle_plate: string | null; vehicle_model: string | null; vehicle_kind: string | null; driver_name: string | null; site_name: string }>(
        `SELECT t.*, v.plate AS vehicle_plate, v.model AS vehicle_model, v.kind AS vehicle_kind, d.full_name AS driver_name, s.name AS site_name
           FROM tms.trip t LEFT JOIN fleet.vehicle v ON v.id = t.vehicle_id LEFT JOIN fleet.driver d ON d.id = t.driver_id JOIN core.site s ON s.id = t.origin_site_id
          WHERE ${siteFilter('t.origin_site_id')} AND (t.planned_departure AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date
          ORDER BY t.planned_departure`, scope)).rows;

      const riskRank = { high: 0, medium: 1, low: 2 } as const;
      const heroTrip = trips.filter((t) => ['departed', 'in_transit'].includes(t.status))
        .sort((a, b) => riskRank[a.risk_level] - riskRank[b.risk_level] || b.delay_minutes - a.delay_minutes)[0];

      let hero = null;
      if (heroTrip) {
        const stops = (await tx.query(
          `SELECT seq, label, lat::float, lon::float, planned_at, actual_at, status FROM tms.trip_stop WHERE trip_id = $1 AND route_version = $2 ORDER BY seq`,
          [heroTrip.id, heroTrip.route_version])).rows;
        const ships = (await tx.query(`SELECT count(*)::int AS n, coalesce(sum(units),0)::int AS u, count(*) FILTER (WHERE at_risk)::int AS r FROM parcel.shipment WHERE trip_id = $1`, [heroTrip.id])).rows[0];
        const rec = (await tx.query(`SELECT id, code, status FROM ai.recommendation WHERE entity_id = $1 ORDER BY created_at DESC LIMIT 1`, [heroTrip.id])).rows[0] ?? null;
        const risk = evaluateTripRisk(toSnapshot(heroTrip));
        hero = {
          tripId: heroTrip.id, code: heroTrip.code, kind: heroTrip.kind, status: heroTrip.status, routeLabel: heroTrip.route_label, routeVersion: heroTrip.route_version,
          originSite: heroTrip.site_name, destination: heroTrip.destination_label, distanceKm: Number(heroTrip.distance_km),
          vehicle: heroTrip.vehicle_plate ? { plate: heroTrip.vehicle_plate, model: heroTrip.vehicle_model, kind: heroTrip.vehicle_kind } : null,
          driver: heroTrip.driver_name, unitsOnBoard: heroTrip.units_on_board, shipments: ships.n, shipmentsAtRisk: ships.r,
          speedKmh: heroTrip.speed_kmh === null ? null : Number(heroTrip.speed_kmh), fuelPct: heroTrip.fuel_pct === null ? null : Number(heroTrip.fuel_pct),
          plannedArrival: heroTrip.planned_arrival, windowEnd: heroTrip.window_end, eta: heroTrip.eta, etaSource: heroTrip.eta_source, etaUpdatedAt: heroTrip.eta_updated_at,
          delayMinutes: heroTrip.delay_minutes, delayCause: heroTrip.delay_cause, risk: heroTrip.risk_level, minutesOverWindow: risk.minutesOverWindow,
          position: heroTrip.last_lat ? { lat: Number(heroTrip.last_lat), lon: Number(heroTrip.last_lon), at: heroTrip.last_position_at, source: heroTrip.position_source } : null,
          stops, recommendation: rec,
        };
      }

      const recommendations = (await tx.query(
        `SELECT r.id, r.code, r.agent, r.engine, r.severity, r.summary, r.causes, r.options, r.confidence::float, r.data_quality, r.status, r.created_at, r.expires_at, t.code AS trip_code
           FROM ai.recommendation r LEFT JOIN tms.trip t ON t.id = r.entity_id
          WHERE r.status = 'pending_approval' AND ${siteFilter('r.site_id')} ORDER BY r.created_at DESC LIMIT 3`, scope)).rows;
      const exceptions = (await tx.query(
        `SELECT e.id, e.kind, e.severity, e.title, e.status, e.opened_at, t.code AS trip_code FROM parcel.exception_case e LEFT JOIN tms.trip t ON t.id = e.trip_id
          WHERE e.status IN ('open','acknowledged','in_progress') AND ${siteFilter('e.site_id')}
          ORDER BY CASE e.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, e.opened_at DESC LIMIT 6`, scope)).rows;

      const sites = (await tx.query(
        `SELECT id, code, name, kind, city, lat::float, lon::float FROM core.site WHERE cardinality($1::uuid[]) = 0 OR id = ANY($1) ORDER BY name`, [ctx.subject.siteIds])).rows;
      const routes = [];
      for (const t of trips.filter((x) => ['departed', 'in_transit'].includes(x.status))) {
        const pts = (await tx.query(`SELECT lat::float, lon::float FROM tms.trip_stop WHERE trip_id = $1 AND route_version = $2 ORDER BY seq`, [t.id, t.route_version])).rows;
        const ageMin = t.last_position_at ? Math.round((now.getTime() - t.last_position_at.getTime()) / 60000) : null;
        routes.push({ tripId: t.id, code: t.code, risk: t.risk_level, points: pts.map((p) => [p.lat, p.lon]),
          vehicle: t.last_lat ? { lat: Number(t.last_lat), lon: Number(t.last_lon), at: t.last_position_at, source: t.position_source, ageMin, stale: ageMin === null || ageMin > STALE_POSITION_MINUTES } : null });
      }

      const timeline = trips.map((t) => ({
        tripId: t.id, code: t.code, kind: t.kind, label: `${t.site_name} → ${t.destination_label}`, status: t.status, risk: t.risk_level,
        plannedDeparture: t.planned_departure, plannedArrival: t.planned_arrival, eta: t.eta, driver: t.driver_name, vehicle: t.vehicle_plate,
      }));

      const nextActions = [
        ...recommendations.map((r) => ({ kind: 'approval', title: `Revisar propuesta ${r.code} (${r.trip_code ?? 'viaje'})`, owner: 'Coordinación de transporte', dueAt: r.expires_at, status: 'pending', href: `/ia/aprobaciones/${r.id}` })),
        ...exceptions.slice(0, 3).map((e) => ({ kind: 'exception', title: e.title, owner: 'Coordinador de sede', dueAt: null, status: e.status, href: null })),
        ...trips.filter((t) => ['planned', 'assigned', 'loading'].includes(t.status) && t.planned_departure > now).slice(0, 3)
          .map((t) => ({ kind: 'departure', title: `Despacho ${t.code} hacia ${t.destination_label}`, owner: t.driver_name ?? 'Sin conductor asignado', dueAt: t.planned_departure, status: t.status, href: null })),
      ];

      return {
        generatedAt: now, dataMode: ctx.dataMode, timezone: 'America/Bogota', lastEventAt: lastEvent,
        scope: { siteId: ctx.siteId, siteName: ctx.siteId ? sites.find((s) => s.id === ctx.siteId)?.name ?? null : null },
        kpis, hero, brief: { engine: 'rules:v1', recommendations, exceptions }, map: { sites, routes, provider: null }, timeline, nextActions,
      };
    });
  }
}
