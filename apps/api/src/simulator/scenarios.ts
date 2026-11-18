/**
 * Escenarios DEMO (ADR-0012). Todas las rutas, distancias, tiempos y costos son SIMULADOS
 * y se rotulan como tales; no provienen de un proveedor de mapas ni de operaciones reales.
 */
import type { RouteAlternative } from '@nexus/domain-core';

export interface StopDef { label: string; lat: number; lon: number; offsetMin: number }

export interface RouteDef { label: string; distanceKm: number; stops: StopDef[] }

export interface ScenarioDef {
  tripCode: string;
  base: RouteDef;
  defaultDelayCause: string;
  alternatives: (RouteAlternative & { route: RouteDef })[];
}

const CALI = { lat: 3.4516, lon: -76.532 };
const YUMBO = { lat: 3.5859, lon: -76.4946 };
const PALMIRA = { lat: 3.5394, lon: -76.3036 };
const CENCAR = { lat: 3.5205, lon: -76.4512 };
const AEROPUERTO = { lat: 3.5432, lon: -76.3816 };
const BUENAVENTURA = { lat: 3.8801, lon: -77.0312 };
const LOBOGUERRERO = { lat: 3.7617, lon: -76.6553 };
const DAGUA = { lat: 3.6566, lon: -76.6914 };

export const SCENARIOS: Record<string, ScenarioDef> = {
  'CAL-2026-0001': {
    tripCode: 'CAL-2026-0001',
    defaultDelayCause: 'Congestión reportada en la Recta Cali–Palmira (simulación)',
    base: {
      label: 'Cali → Yumbo → Palmira · Recta Cali–Palmira',
      distanceKm: 52.4,
      stops: [
        { label: 'Hub Cali (origen)', ...CALI, offsetMin: 0 },
        { label: 'Zona industrial Yumbo', ...YUMBO, offsetMin: 35 },
        { label: 'Centro de distribución Palmira', ...PALMIRA, offsetMin: 105 },
      ],
    },
    alternatives: [
      {
        key: 'reroute_via_cencar', label: 'Desviar por la vía Cencar – Aeropuerto', routeLabel: 'Cali → Yumbo → Cencar → Aeropuerto → Palmira',
        extraKm: 6.8, minutesSaved: 41, costCop: 38000, risks: ['Peaje adicional (simulado)', 'Mayor consumo de combustible'],
        route: {
          label: 'Cali → Yumbo → Cencar → Aeropuerto → Palmira', distanceKm: 59.2,
          stops: [
            { label: 'Hub Cali (origen)', ...CALI, offsetMin: 0 },
            { label: 'Zona industrial Yumbo', ...YUMBO, offsetMin: 35 },
            { label: 'Cruce Cencar', ...CENCAR, offsetMin: 52 },
            { label: 'Vía Aeropuerto', ...AEROPUERTO, offsetMin: 70 },
            { label: 'Centro de distribución Palmira', ...PALMIRA, offsetMin: 92 },
          ],
        },
      },
      {
        key: 'resequence_stops', label: 'Reordenar paradas: Palmira primero', routeLabel: 'Cali → Palmira → Yumbo',
        extraKm: 3.1, minutesSaved: 22, costCop: 12000, risks: ['La entrega en Yumbo pasa a la tarde'],
        route: {
          label: 'Cali → Palmira → Yumbo', distanceKm: 55.5,
          stops: [
            { label: 'Hub Cali (origen)', ...CALI, offsetMin: 0 },
            { label: 'Centro de distribución Palmira', ...PALMIRA, offsetMin: 70 },
            { label: 'Zona industrial Yumbo', ...YUMBO, offsetMin: 125 },
          ],
        },
      },
    ],
  },
  'BUN-CLO-0007': {
    tripCode: 'BUN-CLO-0007',
    defaultDelayCause: 'Paso restringido en el sector de Loboguerrero (simulación)',
    base: {
      label: 'Buenaventura → Cali · Vía al Pacífico', distanceKm: 118.0,
      stops: [
        { label: 'Terminal Buenaventura (origen)', ...BUENAVENTURA, offsetMin: 0 },
        { label: 'Loboguerrero', ...LOBOGUERRERO, offsetMin: 95 },
        { label: 'Hub Cali', ...CALI, offsetMin: 190 },
      ],
    },
    alternatives: [
      {
        key: 'reroute_via_dagua', label: 'Desviar por Dagua (vía antigua)', routeLabel: 'Buenaventura → Dagua → Cali',
        extraKm: 9.5, minutesSaved: 25, costCop: 54000, risks: ['Vía de montaña: restricción para tractocamión de más de 34 t'],
        route: {
          label: 'Buenaventura → Dagua → Cali', distanceKm: 127.5,
          stops: [
            { label: 'Terminal Buenaventura (origen)', ...BUENAVENTURA, offsetMin: 0 },
            { label: 'Dagua', ...DAGUA, offsetMin: 110 },
            { label: 'Hub Cali', ...CALI, offsetMin: 175 },
          ],
        },
      },
    ],
  },
};

/** Posición simulada interpolada sobre la ruta según el progreso (0–1). */
export function positionAlong(stops: StopDef[], progress: number): { lat: number; lon: number } {
  const p = Math.min(Math.max(progress, 0), 1);
  const total = stops[stops.length - 1]!.offsetMin;
  const t = p * total;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]!, b = stops[i]!;
    if (t <= b.offsetMin) {
      const f = (t - a.offsetMin) / Math.max(b.offsetMin - a.offsetMin, 1);
      return { lat: +(a.lat + (b.lat - a.lat) * f).toFixed(6), lon: +(a.lon + (b.lon - a.lon) * f).toFixed(6) };
    }
  }
  const last = stops[stops.length - 1]!;
  return { lat: last.lat, lon: last.lon };
}
