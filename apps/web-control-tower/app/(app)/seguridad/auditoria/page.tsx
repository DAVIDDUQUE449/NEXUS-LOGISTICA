'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { useSession } from '@/lib/session';
import { Status } from '@/components/Status';

interface Entry { seq: number; id: string; actor_kind: string; actor_name: string; action: string; resource_type: string; resource_id: string | null; decision: string; reason: string | null; correlation_id: string; created_at: string }

export default function AuditPage() {
  const { can } = useSession();
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [decision, setDecision] = useState('');
  const [verify, setVerify] = useState<{ ok: boolean; checked: number; brokenAt: number | null } | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!can('audit:read')) return;
    api<{ items: Entry[] }>(`/v1/audit/events?limit=200${decision ? `&decision=${decision}` : ''}`).then((r) => setRows(r.items)).catch((e) => setErr(e.message));
  }, [decision, can]);
  if (!can('audit:read')) return <div className="alert info" style={{ marginTop: 20 }}>Su rol no tiene acceso a la auditoría (bloqueado por permisos).</div>;
  return (
    <>
      <div className="page-head">
        <div><h1>Auditoría</h1><div className="muted">Registro append-only con cadena de hash por empresa (detecta manipulación). No se puede editar ni borrar.</div></div>
        <div className="row wrap">
          <select className="select" value={decision} onChange={(e) => setDecision(e.target.value)} aria-label="Filtrar por decisión">
            <option value="">Todas las decisiones</option><option value="allow">Permitidas</option><option value="deny">Denegadas</option>
          </select>
          <button className="btn btn-ghost" onClick={() => api<typeof verify>('/v1/audit/verify').then(setVerify).catch((e) => setErr(e.message))}>Verificar integridad</button>
        </div>
      </div>
      {verify && <div className={`alert ${verify.ok ? 'ok' : 'error'}`} style={{ marginBottom: 12 }}>{verify.ok ? `Cadena íntegra: ${verify.checked} registros verificados.` : `Cadena rota en el registro #${verify.brokenAt}.`}</div>}
      {err && <div className="alert error">{err}</div>}
      <div className="glass table-wrap">
        <table className="data">
          <thead><tr><th>#</th><th>Fecha</th><th>Actor</th><th>Acción</th><th>Recurso</th><th>Decisión</th><th>Motivo</th><th>Correlación</th></tr></thead>
          <tbody>
            {rows?.map((r) => (
              <tr key={r.id}>
                <td className="mono small">{r.seq}</td><td className="small">{fmtDateTime(r.created_at)}</td>
                <td>{r.actor_name}<div className="tiny soft">{r.actor_kind}</div></td>
                <td className="mono small">{r.action}</td><td className="small">{r.resource_type}</td>
                <td><Status value={r.decision} /></td><td className="small">{r.reason ?? '—'}</td>
                <td className="mono tiny">{r.correlation_id.slice(0, 8)}</td>
              </tr>
            ))}
            {!rows && <tr><td colSpan={8}><div className="skeleton" style={{ height: 20 }} /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
