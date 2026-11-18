/**
 * Diccionario de KPI de la pantalla de inicio (N.02.4). Cada KPI declara numerador/criterio,
 * denominador (si aplica), exclusiones, zona horaria y periodo (O.08, sección 17).
 */
export interface KpiDefinition {
  code: string;
  version: number;
  label: string;
  unit: 'count' | 'percent';
  criterion: string;
  denominator: string | null;
  exclusions: string;
  period: string;
  timezone: string;
}

export const HOME_KPIS: readonly KpiDefinition[] = [
  { code: 'active_shipments', version: 1, label: 'Envíos activos', unit: 'count',
    criterion: 'Envíos con estado distinto de DELIVERED, CANCELLED y RETURN_TO_SENDER', denominator: null,
    exclusions: 'Cancelados y devueltos al remitente', period: 'Instantáneo', timezone: 'America/Bogota' },
  { code: 'units_in_transit', version: 1, label: 'Unidades en tránsito', unit: 'count',
    criterion: 'Suma de unidades de envíos en LINEHAUL_IN_TRANSIT u OUT_FOR_DELIVERY', denominator: null,
    exclusions: 'Unidades en hub', period: 'Instantáneo', timezone: 'America/Bogota' },
  { code: 'delivered_today', version: 1, label: 'Entregados hoy', unit: 'count',
    criterion: 'Envíos con delivered_at dentro del día calendario actual', denominator: 'Envíos entregados + activos con promesa hoy',
    exclusions: 'Ninguna', period: 'Día calendario actual', timezone: 'America/Bogota' },
  { code: 'delayed', version: 1, label: 'Retrasados', unit: 'count',
    criterion: 'Envíos activos cuya promesa (promised_by) ya venció', denominator: 'Envíos activos',
    exclusions: 'Entregados y cancelados', period: 'Instantáneo', timezone: 'America/Bogota' },
  { code: 'at_risk', version: 1, label: 'En riesgo', unit: 'count',
    criterion: 'Envíos activos marcados en riesgo porque la ETA del viaje supera su ventana', denominator: 'Envíos activos',
    exclusions: 'Retrasados (se cuentan aparte)', period: 'Instantáneo', timezone: 'America/Bogota' },
  { code: 'open_exceptions', version: 1, label: 'Novedades', unit: 'count',
    criterion: 'Novedades en estado open, acknowledged o in_progress', denominator: null,
    exclusions: 'Resueltas y cerradas', period: 'Instantáneo', timezone: 'America/Bogota' },
];

/** Porcentaje con denominador explícito; sin datos suficientes devuelve null (no 0 %, sección 17.2). */
export function ratio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/** Tendencia comparada con el periodo anterior; null si no hay base comparable. */
export function trend(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
