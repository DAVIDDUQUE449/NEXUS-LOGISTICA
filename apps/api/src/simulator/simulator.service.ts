import { evaluateTripRisk } from '@nexus/domain-core';
import type { DbService, Tx } from '../db/db.service';
import type { AuditService } from '../audit/audit.service';
import type { EventService } from '../events/event.service';
import type { RecommendationService } from '../ai/recommendation.service';
import type { RequestCtx } from '../auth/auth-context';
import { AppError } from '../common/errors';
import { insertStops, loadTrip, toSnapshot, type TripRow } from '../operations/trip.repo';
import { SCENARIOS, positionAlong } from './scenarios';

type Ctx = Pick<RequestCtx, 'tenant' | 'actor' | 'correlationId' | 'dataMode'>;

/**
 * Simulador DEMO (sección 23.2, ADR-0012): solo opera sobre tenants con data_mode = 'demo'.
 * Genera hechos a través de los mismos servicios de dominio, eventos y auditoría que la operación real.
 */
export class SimulatorService {
  constructor(private readonly db: DbService, private readonly audit: AuditService, private readonly events: EventService,
    private readonly recs: RecommendationService) {}

  private async assertDemo(tx: Tx): Promise<void> {
    const mode = (await tx.query<{ data_mode: string }>('SELECT data_mode FROM core.tenant WHERE id = core.current_tenant()')).rows[0]?.data_mode;
    if (mode !== 'demo') throw new AppError(403, 'DEMO_ONLY', 'El simulador solo funciona en empresas DEMO.');
  }

  /** «Simular retraso»: Exception Agent abre novedad y Route Agent propone alternativas (pendientes de aprobación). */
  async simulateDelay(ctx: Ctx, tripCode = 'CAL-2026-0001', minutes = 47, now = new Date()) {
    return this.db.withTenant(ctx.tenant, async (tx) => {
      await this.assertDemo(tx);
      const trip = await loadTrip(tx, { code: tripCode }, true);
      if (!trip) throw new AppError(404, 'NOT_FOUND', 'Viaje no encontrado');
      if (!['departed', 'in_transit'].includes(trip.status)) throw new AppError(409, 'INVALID_TRANSITION', 'Solo se puede simular retraso en un viaje en tránsito.');
      const scenario = SCENARIOS[trip.code];
      const cause = scenario?.defaultDelayCause ?? 'Retraso reportado en el corredor (simulación)';
      const eta = new Date(trip.planned_arrival.getTime() + minutes * 60000);
      const risk = evaluateTripRisk({ ...toSnapshot(trip), eta }).level;
      const progress = Math.min(0.85, Math.max(0.1, (now.getTime() - (trip.actual_departure ?? trip.planned_departure).getTime()) /
        Math.max(eta.getTime() - (trip.actual_departure ?? trip.planned_departure).getTime(), 1)));
      const stops = scenario?.base.stops;
      const pos = stops ? positionAlong(stops, progress) : { lat: Number(trip.last_lat), lon: Number(trip.last_lon) };
      const updated = (await tx.query<TripRow>(
        `UPDATE tms.trip SET eta = $2, eta_source = 'simulator', eta_updated_at = $3, delay_minutes = $4, delay_cause = $5, risk_level = $6,
            last_lat = $7, last_lon = $8, last_position_at = $3, position_source = 'simulator', speed_kmh = 18, status = 'in_transit', version = version + 1
          WHERE id = $1 RETURNING *`,
        [trip.id, eta, now, minutes, cause, risk, pos.lat, pos.lon])).rows[0]!;
      await this.events.append(tx, ctx, { eventType: 'ETAChanged', entityType: 'trip', entityId: trip.id, entityVersion: updated.version, siteId: trip.origin_site_id,
        source: 'simulator', payload: { eta_before: trip.eta, eta_after: eta, delay_minutes: minutes, cause, source: 'simulator' } });
      await tx.query(`UPDATE parcel.shipment SET at_risk = $2, version = version + 1 WHERE trip_id = $1 AND status NOT IN ('DELIVERED','CANCELLED')`, [trip.id, risk === 'high']);

      // Exception Agent (reglas): novedad deduplicada por viaje.
      let exceptionId: string | null = null;
      if (risk !== 'low') {
        const ex = await tx.query<{ id: string }>(
          `INSERT INTO parcel.exception_case (tenant_id, site_id, trip_id, kind, severity, title, dedupe_key)
           VALUES ($1,$2,$3,'delay',$4,$5,$6) ON CONFLICT (tenant_id, dedupe_key) WHERE status IN ('open','acknowledged','in_progress') DO NOTHING RETURNING id`,
          [ctx.tenant.tenantId, trip.origin_site_id, trip.id, risk === 'high' ? 'high' : 'medium', `Retraso de ${minutes} min en ${trip.code}`, `delay:trip:${trip.id}`]);
        exceptionId = ex.rows[0]?.id ?? null;
        if (exceptionId) {
          await this.events.append(tx, { ...ctx, actor: { id: 'exception', kind: 'agent', name: 'Exception Agent (motor de reglas)' } }, {
            eventType: 'ExceptionOpened', entityType: 'exception_case', entityId: exceptionId, entityVersion: 1, siteId: trip.origin_site_id, source: 'worker',
            payload: { kind: 'delay', trip_code: trip.code, minutes } });
        }
      }
      const recommendationId = await this.recs.proposeForTrip(tx, ctx, updated, now);
      await this.audit.record(tx, ctx, { action: 'simulator.delay', resourceType: 'trip', resourceId: trip.id, decision: 'allow',
        after: { trip: trip.code, minutes, risk, exception_id: exceptionId, recommendation_id: recommendationId } });
      return { tripCode: trip.code, eta, risk, exceptionId, recommendationId };
    });
  }

  /** «Restablecer escenario»: vuelve el viaje a la ruta base y a tiempo (nuevos eventos; el historial no se borra). */
  async resetScenario(ctx: Ctx, tripCode = 'CAL-2026-0001', now = new Date()) {
    return this.db.withTenant(ctx.tenant, async (tx) => {
      await this.assertDemo(tx);
      const trip = await loadTrip(tx, { code: tripCode }, true);
      const scenario = SCENARIOS[tripCode];
      if (!trip || !scenario) throw new AppError(404, 'NOT_FOUND', 'Escenario no encontrado');
      const departure = new Date(now.getTime() - 40 * 60000);
      const plannedArrival = new Date(departure.getTime() + scenario.base.stops.at(-1)!.offsetMin * 60000);
      const eta = new Date(plannedArrival.getTime() - 6 * 60000);
      const newVersion = trip.route_version + 1;
      const pos = positionAlong(scenario.base.stops, 40 / scenario.base.stops.at(-1)!.offsetMin);
      // En DEMO el restablecimiento devuelve el viaje a «in_transit» aunque la máquina de estados no lo permita
      // en operación real; queda registrado como evento ScenarioReset del simulador.
      const updated = (await tx.query<TripRow>(
        `UPDATE tms.trip SET status = 'in_transit', planned_departure = $2, actual_departure = $2, planned_arrival = $3, window_end = $4, eta = $5,
            eta_source = 'simulator', eta_updated_at = $6, delay_minutes = 0, delay_cause = NULL, risk_level = 'low', route_label = $7, route_version = $8,
            distance_km = $9, last_lat = $10, last_lon = $11, last_position_at = $6, position_source = 'simulator', speed_kmh = 54, version = version + 1
          WHERE id = $1 RETURNING *`,
        [trip.id, departure, plannedArrival, new Date(plannedArrival.getTime() + 15 * 60000), eta, now, scenario.base.label, newVersion,
         scenario.base.distanceKm, pos.lat, pos.lon])).rows[0]!;
      await insertStops(tx, ctx.tenant.tenantId, trip.id, newVersion, scenario.base, departure, 40);
      await tx.query(`UPDATE parcel.shipment SET at_risk = false, version = version + 1 WHERE trip_id = $1`, [trip.id]);
      await tx.query(`UPDATE parcel.exception_case SET status = 'resolved', resolved_at = now() WHERE trip_id = $1 AND status IN ('open','acknowledged','in_progress')`, [trip.id]);
      const expired = await tx.query<{ id: string; version: number }>(
        `UPDATE ai.recommendation SET status = 'expired', version = version + 1, decided_at = now() WHERE entity_id = $1 AND status = 'pending_approval' RETURNING id, version`, [trip.id]);
      for (const r of expired.rows) {
        await this.events.append(tx, ctx, { eventType: 'AISuggestionExpired', entityType: 'ai_recommendation', entityId: r.id, entityVersion: r.version, source: 'simulator', payload: { reason: 'scenario_reset' } });
      }
      await this.events.append(tx, ctx, { eventType: 'ScenarioReset', entityType: 'trip', entityId: trip.id, entityVersion: updated.version, siteId: trip.origin_site_id,
        source: 'simulator', payload: { route: scenario.base.label, eta } });
      await this.audit.record(tx, ctx, { action: 'simulator.reset', resourceType: 'trip', resourceId: trip.id, decision: 'allow', after: { trip: tripCode } });
      return { tripCode, eta };
    });
  }
}
