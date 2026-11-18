/**
 * Motor determinista de reglas (ADR-0009, RuleEngine) para el Exception Agent y el Route Agent.
 * Produce recomendaciones reproducibles sin proveedor de IA. Las cifras son de simulación y se
 * etiquetan como tales; el servidor las recalcula antes de ejecutar.
 */

export interface TripSnapshot {
  id: string;
  code: string;
  version: number;
  routeLabel: string;
  routeVersion: number;
  distanceKm: number;
  plannedArrival: Date;
  windowEnd: Date;
  eta: Date | null;
  etaSource: 'simulator' | 'provider' | 'manual';
  etaUpdatedAt: Date | null;
  delayMinutes: number;
  delayCause: string | null;
  unitsOnBoard: number;
  lastPositionAt: Date | null;
}

export interface RouteAlternative {
  key: string;
  label: string;
  routeLabel: string;
  extraKm: number;
  /** minutos ahorrados frente a la ruta actual con el retraso observado */
  minutesSaved: number;
  costCop: number;
  risks: string[];
}

export interface RecommendationDraft {
  agent: 'route';
  severity: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  causes: { code: string; text: string }[];
  evidence: { type: string; source: string; value: string; timestamp: string }[];
  options: {
    key: string;
    label: string;
    routeLabel: string;
    impact: { etaIso: string; delayVsWindowMin: number; extraKm: number; costCop: number };
    risks: string[];
  }[];
  confidence: number;
  dataQuality: 'sufficient' | 'degraded' | 'insufficient';
  requiresApproval: true;
  expiresAt: Date;
}

/** Antigüedad máxima de la posición para considerar datos suficientes. */
export const STALE_POSITION_MINUTES = 30;

export function evaluateTripRisk(trip: TripSnapshot): { level: 'low' | 'medium' | 'high'; minutesOverWindow: number } {
  if (!trip.eta) return { level: 'medium', minutesOverWindow: 0 };
  const over = Math.round((trip.eta.getTime() - trip.windowEnd.getTime()) / 60000);
  if (over > 0) return { level: 'high', minutesOverWindow: over };
  if (over > -20) return { level: 'medium', minutesOverWindow: over };
  return { level: 'low', minutesOverWindow: over };
}

function dataQuality(trip: TripSnapshot, now: Date): RecommendationDraft['dataQuality'] {
  if (!trip.lastPositionAt || !trip.eta) return 'insufficient';
  const ageMin = (now.getTime() - trip.lastPositionAt.getTime()) / 60000;
  if (ageMin > STALE_POSITION_MINUTES * 4) return 'insufficient';
  if (ageMin > STALE_POSITION_MINUTES) return 'degraded';
  return 'sufficient';
}

const fmt = (d: Date) => d.toISOString();

/**
 * Propone mantener ruta o desviar por alternativas. Devuelve null si el viaje no está en riesgo.
 */
export function proposeReroute(trip: TripSnapshot, alternatives: readonly RouteAlternative[], now: Date): RecommendationDraft | null {
  const risk = evaluateTripRisk(trip);
  if (risk.level !== 'high' || !trip.eta) return null;
  const quality = dataQuality(trip, now);
  const baseEta = trip.eta;

  const options: RecommendationDraft['options'] = [
    {
      key: 'keep_route',
      label: 'Mantener ruta actual',
      routeLabel: trip.routeLabel,
      impact: { etaIso: fmt(baseEta), delayVsWindowMin: risk.minutesOverWindow, extraKm: 0, costCop: 0 },
      risks: [`Incumple la ventana por ${risk.minutesOverWindow} min`],
    },
    ...alternatives.map((alt) => {
      const eta = new Date(baseEta.getTime() - alt.minutesSaved * 60000);
      return {
        key: alt.key,
        label: alt.label,
        routeLabel: alt.routeLabel,
        impact: {
          etaIso: fmt(eta),
          delayVsWindowMin: Math.round((eta.getTime() - trip.windowEnd.getTime()) / 60000),
          extraKm: alt.extraKm,
          costCop: alt.costCop,
        },
        risks: alt.risks,
      };
    }),
  ];

  const best = options.slice(1).sort((a, b) => a.impact.delayVsWindowMin - b.impact.delayVsWindowMin)[0];
  const confidenceBase = quality === 'sufficient' ? 0.78 : quality === 'degraded' ? 0.55 : 0.3;

  return {
    agent: 'route',
    severity: risk.minutesOverWindow > 45 ? 'critical' : 'high',
    summary: best
      ? `Riesgo de incumplir la ventana de ${trip.code}: ${risk.minutesOverWindow} min tarde. Alternativa sugerida: ${best.label}.`
      : `Riesgo de incumplir la ventana de ${trip.code}: ${risk.minutesOverWindow} min tarde. Sin alternativas disponibles.`,
    causes: [
      { code: 'ETA_OVER_WINDOW', text: `ETA ${risk.minutesOverWindow} min posterior al fin de la ventana acordada` },
      ...(trip.delayCause ? [{ code: 'OBSERVED_DELAY', text: trip.delayCause }] : []),
    ],
    evidence: [
      { type: 'eta_comparison', source: trip.etaSource, value: `ETA ${fmt(baseEta)} vs ventana ${fmt(trip.windowEnd)}`, timestamp: fmt(trip.etaUpdatedAt ?? now) },
      { type: 'observed_delay', source: trip.etaSource, value: `${trip.delayMinutes} min`, timestamp: fmt(trip.etaUpdatedAt ?? now) },
      { type: 'last_position', source: trip.etaSource, value: trip.lastPositionAt ? fmt(trip.lastPositionAt) : 'sin señal', timestamp: fmt(now) },
    ],
    options,
    confidence: confidenceBase,
    dataQuality: quality,
    requiresApproval: true,
    expiresAt: new Date(now.getTime() + 45 * 60000),
  };
}
