'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { api } from '@/lib/api';
import { bogotaClock, firstName } from '@/lib/format';
import { readPref, useSession, writePref } from '@/lib/session';

/** Navegación principal (N.04). Las secciones sin implementar llevan a una página que explica su hito. */
export const NAV = [
  { href: '/', label: 'Inicio · Command Center', icon: 'home' },
  { href: '/modulo/operacion', label: 'Operación integral', icon: 'layers', pending: true },
  { href: '/modulo/oms', label: 'Cadena de suministro / OMS', icon: 'package', pending: true },
  { href: '/modulo/wms', label: 'Almacenes / WMS', icon: 'warehouse', pending: true },
  { href: '/modulo/parcel', label: 'Mensajería y paquetería', icon: 'box', pending: true },
  { href: '/modulo/tms', label: 'Transporte / TMS', icon: 'truck', pending: true },
  { href: '/modulo/digital-twin', label: 'Gemelo digital 3D', icon: 'cube', pending: true },
  { href: '/ia/aprobaciones', label: 'Nexus AI · Aprobaciones', icon: 'sparkles' },
  { href: '/modulo/finanzas', label: 'Finanzas y CRM', icon: 'money', pending: true },
  { href: '/modulo/bi', label: 'Datos y BI', icon: 'chart', pending: true },
  { href: '/seguridad/auditoria', label: 'Seguridad y auditoría', icon: 'shield' },
  { href: '/config/usuarios', label: 'Configuración', icon: 'settings' },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { me, loading, error, reload } = useSession();
  const router = useRouter();
  const path = usePathname();
  const [theme, setTheme] = useState('nexus-aurora-light');
  const [transparency, setTransparency] = useState('normal');

  useEffect(() => {
    setTheme(readPref('theme', 'nexus-aurora-light'));
    setTransparency(readPref('transparency', 'normal'));
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.transparency = transparency;
  }, [theme, transparency]);
  useEffect(() => {
    if (!loading && error?.status === 401) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [loading, error, router, path]);

  if (loading || (!me && !error)) {
    return <div className="login-wrap"><div className="skeleton" style={{ width: 260, height: 18 }} aria-label="Cargando" /></div>;
  }
  if (!me) {
    return <div className="login-wrap"><div className="alert error" role="alert">{error?.message ?? 'No se pudo cargar la sesión.'}</div></div>;
  }
  if (!me.active) return <TenantPicker />;

  const active = me.active;
  return (
    <div className="shell">
      <nav className="sidebar glass" aria-label="Navegación principal">
        <div className="logo" aria-hidden>N</div>
        {NAV.map((n, i) => {
          const current = n.href === '/' ? path === '/' : path.startsWith(n.href.split('/').slice(0, 3).join('/'));
          return (
            <Link key={n.href} href={n.href} className={`navlink ${i > 7 ? 'secondary' : ''}`} aria-current={current ? 'page' : undefined} aria-label={n.label}>
              <Icon name={n.icon} />
              {'pending' in n && n.pending && <span className="pending-dot" aria-hidden />}
              <span className="tip">{n.label}{'pending' in n && n.pending ? ' · próximo hito' : ''}</span>
            </Link>
          );
        })}
        <div className="spacer" />
      </nav>
      <div className="main">
        <Topbar theme={theme} setTheme={(t) => { setTheme(t); writePref('theme', t); }}
          transparency={transparency} setTransparency={(t) => { setTransparency(t); writePref('transparency', t); }} onContext={reload} />
        {active.dataMode === 'demo' && (
          <div className="demo-banner" role="note"><Icon name="info" size={16} /> ENTORNO DEMO — DATOS SIMULADOS · Empresa ficticia, sin afiliación con operadores reales</div>
        )}
        <main id="contenido">{children}</main>
      </div>
    </div>
  );
}

function Topbar({ theme, setTheme, transparency, setTransparency, onContext }: {
  theme: string; setTheme: (t: string) => void; transparency: string; setTransparency: (t: string) => void; onContext: () => Promise<void>;
}) {
  const { me } = useSession();
  const router = useRouter();
  const [clock, setClock] = useState('');
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = () => setClock(bogotaClock());
    t();
    const id = setInterval(t, 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  if (!me?.active) return null;
  const active = me.active;

  const changeSite = async (siteId: string) => {
    await api('/auth/context', { body: { tenantId: active.tenantId, siteId: siteId || null } });
    await onContext();
    window.dispatchEvent(new Event('nexus:context-changed'));
  };
  const logout = async () => {
    await api('/auth/logout', { body: {} }).catch(() => undefined);
    router.replace('/login');
  };

  return (
    <header className="topbar glass" role="banner">
      <div className="brand">NEXUS <span>LOGISTICS OS</span></div>
      <label className="search" title="La búsqueda universal (guía, pedido, cliente, vehículo, SKU, mensajero) se habilita en el Hito 4">
        <Icon name="search" size={16} />
        <span className="sr-only">Búsqueda universal</span>
        <input disabled placeholder="Buscar guía, pedido, ruta, SKU… (disponible en Hito 4)" />
      </label>
      <div className="grow" />
      <span className="small muted hide-mobile" aria-label="Hora de Colombia">{clock} · COT</span>
      <label className="row">
        <span className="sr-only">Sede</span>
        <select className="select" value={active.siteId ?? ''} onChange={(e) => void changeSite(e.target.value)} aria-label="Seleccionar sede">
          {active.sites.length > 1 && <option value="">Todas mis sedes</option>}
          {active.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <Link href="/ia/aprobaciones" className="iconbtn" aria-label="Aprobaciones y alertas"><Icon name="bell" size={18} /><NotifCount /></Link>
      <div style={{ position: 'relative' }} ref={menuRef}>
        <button className="avatar" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label="Menú de usuario">
          {firstName(me.user.displayName).slice(0, 1).toUpperCase()}
        </button>
        {open && (
          <div className="menu glass solid" role="menu">
            <div style={{ padding: '8px 10px' }}>
              <div style={{ fontWeight: 700 }}>{me.user.displayName}</div>
              <div className="small muted">{me.user.email}</div>
              <div className="small muted">{active.tenantName}</div>
              <div className="row wrap" style={{ marginTop: 6 }}>{active.roles.map((r) => <span key={r} className="chip">{r}</span>)}</div>
            </div>
            <button role="menuitemcheckbox" aria-checked={theme === 'nexus-dark'} onClick={() => setTheme(theme === 'nexus-dark' ? 'nexus-aurora-light' : 'nexus-dark')}>
              <Icon name="moon" size={16} /> {theme === 'nexus-dark' ? 'Tema claro Aurora' : 'Tema oscuro'}
            </button>
            <button role="menuitemcheckbox" aria-checked={transparency === 'reduced'} onClick={() => setTransparency(transparency === 'reduced' ? 'normal' : 'reduced')}>
              <Icon name="eye" size={16} /> {transparency === 'reduced' ? 'Transparencia normal' : 'Reducir transparencia'}
            </button>
            {me.tenants.length > 1 && <Link role="menuitem" href="/seleccionar-empresa"><Icon name="building" size={16} /> Cambiar de empresa</Link>}
            <button role="menuitem" onClick={() => void logout()}><Icon name="logout" size={16} /> Cerrar sesión</button>
          </div>
        )}
      </div>
    </header>
  );
}

function NotifCount() {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => api<{ items: unknown[] }>('/v1/ai/recommendations?status=pending_approval').then((r) => alive && setN(r.items.length)).catch(() => undefined);
    void load();
    const id = setInterval(load, 30000);
    window.addEventListener('nexus:refresh', load);
    return () => { alive = false; clearInterval(id); window.removeEventListener('nexus:refresh', load); };
  }, []);
  return n > 0 ? <span className="badge-count" aria-label={`${n} pendientes`}>{n}</span> : null;
}

export function TenantPicker() {
  const { me, reload } = useSession();
  const [err, setErr] = useState('');
  if (!me) return null;
  return (
    <div className="login-wrap">
      <div className="glass raised login-card stack">
        <h1 style={{ fontSize: 20 }}>Seleccione una empresa</h1>
        {me.tenants.map((t) => (
          <button key={t.id} className="btn btn-ghost" onClick={async () => {
            try { await api('/auth/context', { body: { tenantId: t.id } }); await reload(); } catch (e) { setErr((e as Error).message); }
          }}>{t.name} {t.dataMode === 'demo' && <span className="chip">DEMO</span>}</button>
        ))}
        {!me.tenants.length && <p className="muted">Su usuario no tiene empresas activas. Contacte al administrador.</p>}
        {err && <div className="alert error">{err}</div>}
      </div>
    </div>
  );
}
