const MAP: Record<string, { tone: string; label: string }> = {
  high: { tone: 'danger', label: 'Riesgo alto' }, medium: { tone: 'warn', label: 'Riesgo medio' }, low: { tone: 'ok', label: 'En tiempo' },
  critical: { tone: 'danger', label: 'Crítica' },
  pending_approval: { tone: 'warn', label: 'Aprobación pendiente' }, approved: { tone: 'info', label: 'Aprobada' }, executed: { tone: 'ok', label: 'Ejecutada' },
  rejected: { tone: 'neutral', label: 'Rechazada' }, expired: { tone: 'neutral', label: 'Vencida' }, revision_requested: { tone: 'info', label: 'Revisión solicitada' },
  failed: { tone: 'danger', label: 'Falló' }, executing: { tone: 'info', label: 'En progreso' },
  open: { tone: 'danger', label: 'Abierta' }, acknowledged: { tone: 'warn', label: 'Reconocida' }, in_progress: { tone: 'info', label: 'En gestión' }, resolved: { tone: 'ok', label: 'Resuelta' },
  planned: { tone: 'neutral', label: 'Planeado' }, assigned: { tone: 'info', label: 'Asignado' }, loading: { tone: 'info', label: 'Cargando' },
  departed: { tone: 'info', label: 'Despachado' }, in_transit: { tone: 'info', label: 'En tránsito' }, arrived: { tone: 'ok', label: 'Llegó' }, closed: { tone: 'ok', label: 'Cerrado' },
  active: { tone: 'ok', label: 'Activo' }, revoked: { tone: 'neutral', label: 'Revocado' },
  allow: { tone: 'ok', label: 'Permitido' }, deny: { tone: 'danger', label: 'Denegado' },
  sufficient: { tone: 'ok', label: 'Datos suficientes' }, degraded: { tone: 'warn', label: 'Datos degradados' }, insufficient: { tone: 'danger', label: 'Datos insuficientes' },
};

export function Status({ value, label }: { value: string; label?: string }) {
  const m = MAP[value] ?? { tone: 'neutral', label: value };
  return <span className={`status ${m.tone}`}>{label ?? m.label}</span>;
}
