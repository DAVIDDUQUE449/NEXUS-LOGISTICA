'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { agoLabel, fmtCop, fmtDateTime, fmtNumber, fmtTime } from '@/lib/format';
import { Status } from '@/components/Status';
import { Icon } from '@/components/Icon';

interface Option { key: string; label: string; routeLabel: string; impact: { etaIso: string; delayVsWindowMin: number; extraKm: number; costCop: number }; risks: string[] }
interface Detail {
  id: string; code: string; version: number; agent: string; engine: string; mode: string; severity: string; summary: string; status: string;
  causes: { code: string; text: string }[]; evidence: { type: string; source: string; value: string; timestamp: string }[]; options: Option[];
  confidence: number; data_quality: string; expires_at: string; created_at: string; decided_at: string | null; contextChanged: boolean; canDecide: boolean;
  trip: { code: string; routeLabel: string; eta: string | null; windowEnd: string; plannedArrival: string; delayMinutes: number; status: string; unitsOnBoard: number } | null;
  approvals: { decision: string; option_key: string | null; approver_name: string; comment: string | null; created_at: string }[];
  execution: { status: string; result: Record<string, unknown>; created_at: string } | null;
}

export default function RecommendationDetail() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState('');
  const [choice, setChoice] = useState('');
  const [comment, setComment] = useState('');
  const [confirm, setConfirm] = useState<null | 'approved' | 'rejected' | 'revision_requested'>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  // Una clave de idempotencia por intento de decisión: los reintentos reutilizan la misma.
  const idemKey = useRef<string>('');

  const load = useCallback(() => api<Detail>(`/v1/ai/recommendations/${id}`).then((x) => {
    setD(x);
    setChoice((c) => c || x.options.find((o) => o.key !== 'keep_route')?.key || x.options[0]?.key || '');
  }).catch((e) => setErr(e.message)), [id]);
  useEffect(() => { void load(); }, [load]);

  const decide = async (decision: 'approved' | 'rejected' | 'revision_requested') => {
    if (!d) return;
    setBusy(true);
    setResult(null);
    if (!idemKey.current) idemKey.current = newIdempotencyKey('decide');
    try {
      const r = await api<{ status: string; execution: Record<string, unknown> | null }>(`/v1/ai/recommendations/${d.id}/decide`, {
        body: { version: d.version, decision, ...(decision === 'approved' ? { optionKey: choice } : {}), ...(comment.trim() ? { comment: comment.trim() } : {}) },
        idempotencyKey: idemKey.current,
      });
      setResult({ ok: true, text: r.status === 'executed' ? 'Aprobada y ejecutada una sola vez. Se actualizaron el viaje, la ETA, el mapa, los KPI y la auditoría.' : `Decisión registrada: ${r.status}.` });
      idemKey.current = '';
      setConfirm(null);
      await load();
    } catch (e) {
      const ae = e as ApiError;
      setResult({ ok: false, text: `${ae.message}${ae.correlationId ? ` (ref. ${ae.correlationId.slice(0, 8)})` : ''}` });
      if (ae.status !== 0) idemKey.current = '';
      setConfirm(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (err) return <div className="alert error" style={{ marginTop: 20 }}>{err} · <Link href="/ia/aprobaciones">Volver</Link></div>;
  if (!d) return <div className="skeleton" style={{ height: 300, marginTop: 20 }} />;
  const current = d.options.find((o) => o.key === 'keep_route');
  const selected = d.options.find((o) => o.key === choice);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="small muted"><Link href="/ia/aprobaciones">Centro de aprobaciones</Link> / {d.code}</div>
          <h1>{d.summary}</h1>
          <div className="row wrap" style={{ marginTop: 6 }}>
            <Status value={d.status} /><Status value={d.severity} /><Status value={d.data_quality} />
            <span className="chip">Route Agent · {d.engine}</span><span className="chip">{d.mode === 'demo' ? 'DEMO · simulación' : 'REAL'}</span><span className="chip">v{d.version}</span>
          </div>
        </div>
        <div className="small muted">Creada {fmtDateTime(d.created_at)} · vence {fmtTime(d.expires_at)}</div>
      </div>

      {result && <div className={`alert ${result.ok ? 'ok' : 'error'}`} role="status" style={{ marginBottom: 12 }}>{result.text}</div>}
      {d.contextChanged && d.status === 'pending_approval' && <div className="alert error" style={{ marginBottom: 12 }}>El viaje cambió después de esta propuesta: al decidir, el servidor la invalidará y pedirá una nueva evaluación.</div>}

      <div className="grid-main" style={{ marginTop: 0 }}>
        <section className="glass panel stack" aria-labelledby="opt-title" style={{ gap: 14 }}>
          <h2 id="opt-title" className="panel-title">Comparar opciones · antes / después</h2>
          <div className="options" role="radiogroup" aria-label="Opciones de la recomendación">
            {d.options.map((o) => (
              <label key={o.key} className="option">
                <input type="radio" name="opt" value={o.key} checked={choice === o.key} onChange={() => setChoice(o.key)} disabled={d.status !== 'pending_approval'}
                  aria-label={`${o.label}: ETA ${fmtTime(o.impact.etaIso)}, ${o.impact.delayVsWindowMin > 0 ? `${o.impact.delayVsWindowMin} min sobre la ventana` : `${Math.abs(o.impact.delayVsWindowMin)} min de margen`}`} />
                <div className="row between"><strong>{o.label}</strong>{o.key === 'keep_route' && <span className="chip">actual</span>}</div>
                <div className="small muted">{o.routeLabel}</div>
                <div className="row wrap small">
                  <span>ETA <b>{fmtTime(o.impact.etaIso)}</b></span>
                  <span className={`status ${o.impact.delayVsWindowMin > 0 ? 'danger' : 'ok'}`}>{o.impact.delayVsWindowMin > 0 ? `+${o.impact.delayVsWindowMin} min sobre ventana` : `${Math.abs(o.impact.delayVsWindowMin)} min de margen`}</span>
                </div>
                <div className="small">+{fmtNumber(o.impact.extraKm, 1)} km · {fmtCop(o.impact.costCop)} adicional</div>
                <ul className="tiny soft" style={{ margin: 0, paddingLeft: 16 }}>{o.risks.map((r) => <li key={r}>{r}</li>)}</ul>
              </label>
            ))}
          </div>
          {current && selected && selected.key !== current.key && (
            <div className="alert info small">
              Cambio propuesto: ETA {fmtTime(current.impact.etaIso)} → <b>{fmtTime(selected.impact.etaIso)}</b> ({current.impact.delayVsWindowMin - selected.impact.delayVsWindowMin} min menos),
              +{fmtNumber(selected.impact.extraKm, 1)} km. El servidor recalcula estas cifras antes de ejecutar.
            </div>
          )}
          {d.status === 'pending_approval' && (
            d.canDecide ? (
              <div className="stack">
                <label className="field">Comentario (obligatorio para rechazar o pedir revisión)
                  <textarea className="input" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
                </label>
                <div className="row wrap">
                  <button className="btn btn-primary" disabled={busy || !choice} onClick={() => setConfirm('approved')}><Icon name="check" size={16} /> Aprobar opción seleccionada</button>
                  <button className="btn btn-ghost" disabled={busy || comment.trim().length < 3} onClick={() => setConfirm('rejected')}>Rechazar</button>
                  <button className="btn btn-ghost" disabled={busy || comment.trim().length < 3} onClick={() => setConfirm('revision_requested')}>Solicitar revisión</button>
                </div>
              </div>
            ) : <div className="alert info">Su rol puede ver esta propuesta, pero no decidirla (bloqueado por permisos).</div>
          )}
        </section>

        <section className="glass panel stack" aria-labelledby="ev-title">
          <h2 id="ev-title" className="panel-title">Causas, evidencia y contexto</h2>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{d.causes.map((c) => <li key={c.code}>{c.text}</li>)}</ul>
          <div className="small">Confianza {Math.round(d.confidence * 100)} %</div>
          <div className="confidence"><span style={{ width: `${Math.round(d.confidence * 100)}%` }} /></div>
          <table className="data small" style={{ borderRadius: 12, overflow: 'hidden' }}>
            <thead><tr><th>Evidencia</th><th>Valor</th><th>Fuente</th></tr></thead>
            <tbody>{d.evidence.map((e, i) => <tr key={i}><td>{e.type}</td><td className="small">{e.value.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, (m) => fmtTime(m))}</td><td>{e.source === 'simulator' ? 'simulador' : e.source}</td></tr>)}</tbody>
          </table>
          {d.trip && (
            <div className="stat">
              <div className="k">Viaje {d.trip.code} · {d.trip.status}</div>
              <div className="small">{d.trip.routeLabel}</div>
              <div className="small">ETA actual {fmtTime(d.trip.eta)} · ventana hasta {fmtTime(d.trip.windowEnd)} · {d.trip.unitsOnBoard} unidades a bordo</div>
            </div>
          )}
          <h3 className="panel-title">Historial de decisiones</h3>
          {d.approvals.length === 0 && <div className="small muted">Sin decisiones todavía.</div>}
          {d.approvals.map((a, i) => (
            <div key={i} className="small"><Status value={a.decision === 'approved' ? 'approved' : a.decision} /> {a.approver_name} · {fmtDateTime(a.created_at)}{a.option_key ? ` · opción ${a.option_key}` : ''}{a.comment ? ` — «${a.comment}»` : ''}</div>
          ))}
          {d.execution && <div className="alert ok small">Ejecutada {agoLabel(d.execution.created_at)}: {String(d.execution.result.route ?? d.execution.result.action)}</div>}
        </section>
      </div>

      {confirm && (
        <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" style={{ position: 'fixed', inset: 0, background: 'rgba(23,23,46,.35)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 16 }}>
          <div className="glass solid raised panel stack" style={{ maxWidth: 460 }}>
            <h2 id="confirm-title" style={{ fontSize: 18 }}>{confirm === 'approved' ? 'Confirmar aprobación' : confirm === 'rejected' ? 'Confirmar rechazo' : 'Solicitar revisión'}</h2>
            <p className="small muted" style={{ margin: 0 }}>
              {confirm === 'approved' ? `Se ejecutará «${selected?.label}» sobre ${d.trip?.code}. La acción queda firmada a su nombre y auditada. Si el contexto cambió, el servidor la rechazará.` :
                'La ruta no cambia. La decisión y el motivo quedan auditados.'}
            </p>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setConfirm(null)} disabled={busy} autoFocus>Cancelar</button>
              <button className="btn btn-primary" onClick={() => void decide(confirm)} disabled={busy}>{busy ? 'Procesando…' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
