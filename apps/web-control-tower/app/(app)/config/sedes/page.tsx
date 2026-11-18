'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Site { id: string; code: string; name: string; kind: string; city: string; department: string; lat: number; lon: number; status: string }
const KIND: Record<string, string> = { hub: 'Hub de clasificación', warehouse: 'Almacén / CD', terminal: 'Terminal', branch: 'Sucursal', store: 'Tienda', pudo: 'Punto PUDO', yard: 'Patio' };

export default function SitesPage() {
  const [rows, setRows] = useState<Site[] | null>(null);
  useEffect(() => { api<{ items: Site[] }>('/v1/sites').then((r) => setRows(r.items)).catch(() => setRows([])); }, []);
  return (
    <>
      <div className="page-head">
        <div><h1>Sedes y red</h1><div className="muted">Sedes visibles según su alcance. Datos ficticios del entorno DEMO.</div></div>
        <div className="row"><Link className="btn btn-ghost btn-sm" href="/config/usuarios">Usuarios y roles</Link></div>
      </div>
      <div className="glass table-wrap">
        <table className="data">
          <thead><tr><th>Código</th><th>Nombre</th><th>Tipo</th><th>Ciudad</th><th>Coordenadas</th></tr></thead>
          <tbody>{rows?.map((s) => <tr key={s.id}><td className="mono">{s.code}</td><td>{s.name}</td><td>{KIND[s.kind] ?? s.kind}</td><td>{s.city}, {s.department}</td><td className="mono small">{s.lat.toFixed(4)}, {s.lon.toFixed(4)}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}
