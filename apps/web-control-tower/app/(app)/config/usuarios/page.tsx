'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { useSession } from '@/lib/session';
import { Status } from '@/components/Status';

interface U { id: string; email: string; display_name: string; role_code: string; role_name: string; site_ids: string[]; status: string; created_at: string }
interface Role { code: string; name: string; mfaRequired: boolean; interface: string }

export default function UsersPage() {
  const { me, can } = useSession();
  const [rows, setRows] = useState<U[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ email: '', displayName: '', roleCode: 'data_analyst', siteIds: [] as string[], initialPassword: '' });
  const sites = me?.active?.sites ?? [];
  const load = useCallback(() => api<{ items: U[] }>('/v1/users').then((r) => setRows(r.items)).catch((e) => setMsg({ ok: false, text: e.message })), []);
  useEffect(() => {
    if (!can('users:read')) return;
    void load();
    api<{ items: Role[] }>('/v1/roles').then((r) => setRoles(r.items)).catch(() => undefined);
  }, [load, can]);

  if (!can('users:read')) return <div className="alert info" style={{ marginTop: 20 }}>Su rol no puede administrar usuarios (bloqueado por permisos).</div>;
  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? id.slice(0, 8);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await api('/v1/users', { body: form });
      setMsg({ ok: true, text: `Usuario ${form.email} creado. Entréguele la contraseña inicial por un canal seguro.` });
      setForm({ ...form, email: '', displayName: '', initialPassword: '' });
      await load();
    } catch (err) {
      const ae = err as ApiError;
      const details = Array.isArray(ae.details) ? ` (${(ae.details as { path: string; message: string }[]).map((d) => `${d.path}: ${d.message}`).join('; ')})` : '';
      setMsg({ ok: false, text: ae.message + details });
    }
  };
  const deactivate = async (u: U) => {
    if (!window.confirm(`¿Desactivar a ${u.display_name}? Se revocan su acceso y todas sus sesiones de inmediato.`)) return;
    try {
      const r = await api<{ sessionsRevoked: number }>(`/v1/users/${u.id}/deactivate`, { body: {} });
      setMsg({ ok: true, text: `${u.display_name} desactivado. Sesiones revocadas: ${r.sessionsRevoked}.` });
      await load();
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Usuarios y roles</h1><div className="muted">RBAC + ABAC por sede, validado en el servidor. Cada cambio queda auditado.</div></div>
        <Link className="btn btn-ghost btn-sm" href="/config/sedes">Sedes</Link>
      </div>
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'error'}`} role="status" style={{ marginBottom: 12 }}>{msg.text}</div>}
      {can('users:manage') && (
        <form className="glass panel stack" onSubmit={create} style={{ marginBottom: 16 }} aria-labelledby="new-user">
          <h2 id="new-user" className="panel-title">Nuevo usuario</h2>
          <div className="form-grid">
            <label className="field">Nombre<input className="input" required minLength={2} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
            <label className="field">Correo<input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="field">Rol
              <select className="select" value={form.roleCode} onChange={(e) => setForm({ ...form, roleCode: e.target.value })}>
                {roles.filter((r) => r.code !== 'security_admin').map((r) => <option key={r.code} value={r.code}>{r.name}{r.mfaRequired ? ' (MFA requerido)' : ''}</option>)}
              </select>
            </label>
            <label className="field">Contraseña inicial (mín. 12)<input className="input" type="password" required minLength={12} autoComplete="new-password" value={form.initialPassword} onChange={(e) => setForm({ ...form, initialPassword: e.target.value })} /></label>
            <fieldset className="field" style={{ gridColumn: '1 / -1', border: 0, padding: 0, margin: 0 }}>
              <legend style={{ marginBottom: 4 }}>Sedes (ninguna marcada = todas)</legend>
              <div className="row wrap">{sites.map((s) => (
                <label key={s.id} className="chip" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.siteIds.includes(s.id)} onChange={(e) => setForm({ ...form, siteIds: e.target.checked ? [...form.siteIds, s.id] : form.siteIds.filter((x) => x !== s.id) })} /> {s.name}
                </label>
              ))}</div>
            </fieldset>
          </div>
          <div><button className="btn btn-primary" type="submit">Crear usuario</button></div>
        </form>
      )}
      <div className="glass table-wrap">
        <table className="data">
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Sedes</th><th>Estado</th><th>Alta</th><th><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody>
            {rows?.map((u) => (
              <tr key={`${u.id}-${u.role_code}`}>
                <td>{u.display_name}</td><td className="small">{u.email}</td><td>{u.role_name}</td>
                <td className="small">{u.site_ids.length ? u.site_ids.map(siteName).join(', ') : 'Todas'}</td>
                <td><Status value={u.status} /></td><td className="small">{fmtDateTime(u.created_at)}</td>
                <td>{can('users:manage') && u.status === 'active' && u.id !== me?.user.id && <button className="btn btn-sm btn-ghost" onClick={() => void deactivate(u)}>Desactivar</button>}</td>
              </tr>
            ))}
            {!rows && <tr><td colSpan={7}><div className="skeleton" style={{ height: 20 }} /></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
