'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { Status } from '@/components/Status';

interface Row { id: string; code: string; agent: string; severity: string; summary: string; confidence: number; data_quality: string; status: string; created_at: string; trip_code: string | null; site_name: string }
const FILTERS = [['', 'Todas'], ['pending_approval', 'Pendientes'], ['executed', 'Ejecutadas'], ['rejected', 'Rechazadas'], ['expired', 'Vencidas']] as const;

export default function ApprovalsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    setRows(null);
    api<{ items: Row[] }>(`/v1/ai/recommendations${filter ? `?status=${filter}` : ''}`).then((r) => setRows(r.items)).catch((e) => setErr(e.message));
  }, [filter]);
  return (
    <>
      <div className="page-head">
        <div><h1>Centro de aprobaciones · Nexus AI</h1><div className="muted">Los agentes proponen; una persona autorizada decide; el servidor revalida y ejecuta una sola vez.</div></div>
        <div className="row wrap" role="group" aria-label="Filtrar por estado">
          {FILTERS.map(([v, l]) => <button key={v} className={`btn btn-sm ${filter === v ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={filter === v} onClick={() => setFilter(v)}>{l}</button>)}
        </div>
      </div>
      {err && <div className="alert error">{err}</div>}
      <div className="glass table-wrap">
        <table className="data">
          <thead><tr><th>Código</th><th>Resumen</th><th>Viaje · sede</th><th>Severidad</th><th>Confianza</th><th>Estado</th><th>Creada</th></tr></thead>
          <tbody>
            {rows?.map((r) => (
              <tr key={r.id}>
                <td className="mono"><Link href={`/ia/aprobaciones/${r.id}`}>{r.code}</Link></td>
                <td style={{ maxWidth: 420 }}>{r.summary}<div className="tiny soft">{r.agent} agent · {r.data_quality === 'sufficient' ? 'datos suficientes' : r.data_quality}</div></td>
                <td>{r.trip_code}<div className="tiny soft">{r.site_name}</div></td>
                <td><Status value={r.severity} /></td>
                <td>{Math.round(r.confidence * 100)} %</td>
                <td><Status value={r.status} /></td>
                <td className="small">{fmtDateTime(r.created_at)}</td>
              </tr>
            ))}
            {rows && !rows.length && <tr><td colSpan={7} className="muted">No hay recomendaciones con este filtro.</td></tr>}
            {!rows && <tr><td colSpan={7}><div className="skeleton" style={{ height: 20 }} /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
