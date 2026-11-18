import { describe, it, expect } from 'vitest';
import { proposeReroute, evaluateTripRisk, type TripSnapshot, ratio, trend, uuidv7 } from '../src';

const now = new Date('2026-11-18T15:00:00Z');
const trip = (o: Partial<TripSnapshot> = {}): TripSnapshot => ({
  id: 'trip-1', code: 'CAL-2026-0001', version: 3, routeLabel: 'Cali → Yumbo → Palmira (Recta Cali-Palmira)', routeVersion: 1,
  distanceKm: 48, plannedArrival: new Date('2026-11-18T16:00:00Z'), windowEnd: new Date('2026-11-18T16:15:00Z'),
  eta: new Date('2026-11-18T16:47:00Z'), etaSource: 'simulator', etaUpdatedAt: now, delayMinutes: 47,
  delayCause: 'Congestión en la Recta Cali-Palmira', unitsOnBoard: 34, lastPositionAt: new Date('2026-11-18T14:55:00Z'), ...o,
});
const alts = [{ key: 'reroute_via_yumbo_cencar', label: 'Desviar por Vía Yumbo–Cencar', routeLabel: 'Cali → Cencar → Palmira',
  extraKm: 6.8, minutesSaved: 41, costCop: 38000, risks: ['Peaje adicional'] }];

describe('RuleEngine — Route Agent', () => {
  it('evalúa riesgo alto cuando la ETA supera la ventana', () => {
    expect(evaluateTripRisk(trip())).toEqual({ level: 'high', minutesOverWindow: 32 });
  });
  it('no propone nada si no hay riesgo alto', () => {
    expect(proposeReroute(trip({ eta: new Date('2026-11-18T15:30:00Z') }), alts, now)).toBeNull();
  });
  it('propone mantener o desviar con impacto calculado y aprobación obligatoria', () => {
    const r = proposeReroute(trip(), alts, now)!;
    expect(r.requiresApproval).toBe(true);
    expect(r.options.map((o) => o.key)).toEqual(['keep_route', 'reroute_via_yumbo_cencar']);
    expect(r.options[1]!.impact.delayVsWindowMin).toBe(-9);
    expect(r.options[1]!.impact.extraKm).toBe(6.8);
    expect(r.dataQuality).toBe('sufficient');
  });
  it('baja la confianza con posición antigua y declara datos insuficientes (U40)', () => {
    const r = proposeReroute(trip({ lastPositionAt: new Date('2026-11-18T12:00:00Z') }), alts, now)!;
    expect(r.dataQuality).toBe('insufficient');
    expect(r.confidence).toBeLessThan(0.5);
  });
  it('es determinista: misma entrada, misma salida', () => {
    expect(proposeReroute(trip(), alts, now)).toEqual(proposeReroute(trip(), alts, now));
  });
});

describe('KPI y utilidades', () => {
  it('ratio sin denominador devuelve null (Sin datos suficientes)', () => {
    expect(ratio(5, 0)).toBeNull();
    expect(ratio(1, 3)).toBe(33.3);
  });
  it('trend sin base comparable devuelve null', () => {
    expect(trend(10, null)).toBeNull();
    expect(trend(12, 10)).toBe(20);
  });
  it('uuidv7 tiene versión 7 y es ordenable por tiempo', () => {
    const a = uuidv7(1_700_000_000_000), b = uuidv7(1_700_000_000_001);
    expect(a[14]).toBe('7');
    expect(a < b).toBe(true);
  });
});
