import type { TripSnapshot } from '@nexus/domain-core';
import type { Tx } from '../db/db.service';
import type { RouteDef } from '../simulator/scenarios';

export interface TripRow {
  id: string; tenant_id: string; code: string; kind: string; origin_site_id: string; destination_label: string;
  status: string; planned_departure: Date; planned_arrival: Date; window_end: Date; actual_departure: Date | null;
  eta: Date | null; eta_source: 'simulator' | 'provider' | 'manual'; eta_updated_at: Date | null; route_label: string;
  route_version: number; distance_km: string; units_on_board: number; last_lat: string | null; last_lon: string | null;
  last_position_at: Date | null; position_source: string | null; speed_kmh: string | null; fuel_pct: string | null;
  delay_minutes: number; delay_cause: string | null; risk_level: 'low' | 'medium' | 'high'; version: number;
  vehicle_id: string | null; driver_id: string | null;
}

export async function loadTrip(tx: Tx, where: { id?: string; code?: string }, forUpdate = false): Promise<TripRow | null> {
  const col = where.id ? 'id' : 'code';
  const { rows } = await tx.query<TripRow>(
    `SELECT * FROM tms.trip WHERE ${col} = $1 ${forUpdate ? 'FOR UPDATE' : ''}`, [where.id ?? where.code]);
  return rows[0] ?? null;
}

export function toSnapshot(t: TripRow): TripSnapshot {
  return {
    id: t.id, code: t.code, version: t.version, routeLabel: t.route_label, routeVersion: t.route_version,
    distanceKm: Number(t.distance_km), plannedArrival: t.planned_arrival, windowEnd: t.window_end, eta: t.eta,
    etaSource: t.eta_source, etaUpdatedAt: t.eta_updated_at, delayMinutes: t.delay_minutes, delayCause: t.delay_cause,
    unitsOnBoard: t.units_on_board, lastPositionAt: t.last_position_at,
  };
}

/** Inserta las paradas de una nueva versión de ruta (las anteriores se conservan como historial). */
export async function insertStops(tx: Tx, tenantId: string, tripId: string, routeVersion: number, route: RouteDef, departure: Date, doneUntilMin = 0): Promise<void> {
  for (const [i, s] of route.stops.entries()) {
    const planned = new Date(departure.getTime() + s.offsetMin * 60000);
    const done = s.offsetMin <= doneUntilMin;
    await tx.query(
      `INSERT INTO tms.trip_stop (tenant_id, trip_id, seq, label, lat, lon, planned_at, actual_at, route_version, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [tenantId, tripId, i + 1, s.label, s.lat, s.lon, planned, done ? planned : null, routeVersion, done ? 'done' : 'pending']);
  }
}
