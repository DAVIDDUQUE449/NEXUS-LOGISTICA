'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Icon } from './Icon';
import { Status } from './Status';
import { agoLabel, fmtNumber, fmtTime, minutesAgo } from '@/lib/format';

/* ---------------- Tipos del resumen (GET /v1/dashboard/summary) ---------------- */
export interface Kpi { code: string; label: string; value: number; denominator: number | null; source: string; updatedAt: string;
  definition: { criterion: string; denominator: string | null; exclusions: string; period: string; timezone: string; version: number } }
export interface Stop { seq: number; label: string; lat: number; lon: number; planned_at: string; actual_at: string | null; status: string }
export interface Hero {
  tripId: string; code: string; kind: string; status: string; routeLabel: string; routeVersion: number; originSite: string; destination: string; distanceKm: number;
  vehicle: { plate: string; model: string; kind: string } | null; driver: string | null; unitsOnBoard: number; shipments: number; shipmentsAtRisk: number;
  speedKmh: number | null; fuelPct: number | null; plannedArrival: string; windowEnd: string; eta: string | null; etaSource: string; etaUpdatedAt: string | null;
  delayMinutes: number; delayCause: string | null; risk: 'low' | 'medium' | 'high'; minutesOverWindow: number;
  position: { lat: number; lon: number; at: string; source: string } | null; stops: Stop[]; recommendation: { id: string; code: string; status: string } | null;
}
export interface Rec { id: string; code: string; agent: string; engine: string; severity: string; summary: string; causes: { code: string; text: string }[];
  options: { key: string; label: string; impact: { delayVsWindowMin: number; extraKm: number } }[]; confidence: number; data_quality: string; status: string; created_at: string; trip_code: string | null }
export interface Summary {
  generatedAt: string; dataMode: 'demo' | 'real'; lastEventAt: string | null; scope: { siteId: string | null; siteName: string | null };
  kpis: Kpi[]; hero: Hero | null;
  brief: { engine: string; recommendations: Rec[]; exceptions: { id: string; kind: string; severity: string; title: string; status: string; opened_at: string; trip_code: string | null }[] };
  map: { sites: { id: string; code: string; name: string; kind: string; city: string; lat: number; lon: number }[];
    routes: { tripId: string; code: string; risk: string; points: [number, number][]; vehicle: { lat: number; lon: number; at: string; source: string; ageMin: number | null; stale: boolean } | null }[] };
  timeline: { tripId: string; code: string; kind: string; label: string; status: string; risk: string; plannedDeparture: string; plannedArrival: string; eta: string | null; driver: string | null; vehicle: string | null }[];
  nextActions: { kind: string; title: string; owner: string; dueAt: string | null; status: string; href: string | null }[];
}

/* ---------------- KPI ---------------- */
const KPI_ICON: Record<string, { icon: string; tone: string }> = {
  active_shipments: { icon: 'package', tone: '' }, units_in_transit: { icon: 'truck', tone: '' }, delivered_today: { icon: 'check', tone: 'ok' },
  delayed: { icon: 'clock', tone: 'danger' }, at_risk: { icon: 'alert', tone: 'warn' }, open_exceptions: { icon: 'bell', tone: 'warn' },
};

export function KpiGrid({ kpis }: { kpis: Kpi[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const sel = kpis.find((k) => k.code === open);
  return (
    <section aria-label="Indicadores clave">
      <div className="kpis">
        {kpis.map((k) => {
          const meta = KPI_ICON[k.code] ?? { icon: 'chart', tone: '' };
          return (
            <button key={k.code} className={`glass kpi ${meta.tone}`} onClick={() => setOpen(open === k.code ? null : k.code)} aria-expanded={open === k.code}
              aria-label={`${k.label}: ${k.value}${k.denominator !== null ? ` de ${k.denominator}` : ''}. Ver definición`}>
              <div className="row between"><span className="ico"><Icon name={meta.icon} size={18} /></span><Icon name="info" size={14} /></div>
              <div className="value">{fmtNumber(k.value)}</div>
              <div className="label">{k.label}</div>
              <div className="tiny soft">{k.denominator !== null ? `de ${fmtNumber(k.denominator)} · ` : ''}sin base comparable aún</div>
            </button>
          );
        })}
      </div>
      {sel && (
        <div className="glass solid panel" style={{ marginTop: 10 }} role="region" aria-label={`Definición de ${sel.label}`}>
          <div className="row between wrap">
            <strong>{sel.label} · definición v{sel.definition.version}</strong>
            <button className="btn btn-sm btn-ghost" onClick={() => setOpen(null)}>Cerrar</button>
          </div>
          <div className="small" style={{ marginTop: 6 }}><b>Criterio:</b> {sel.definition.criterion}</div>
          {sel.definition.denominator && <div className="small"><b>Denominador:</b> {sel.definition.denominator}</div>}
          <div className="small"><b>Exclusiones:</b> {sel.definition.exclusions} · <b>Periodo:</b> {sel.definition.period} · <b>Zona horaria:</b> {sel.definition.timezone}</div>
          <div className="small muted"><b>Fuente:</b> <span className="mono">{sel.source}</span> · calculado {fmtTime(sel.updatedAt)}</div>
        </div>
      )}
    </section>
  );
}

/* ---------------- Camión (render optimizado SVG; N.02.5) ---------------- */
function TruckArt({ risk, plate }: { risk: string; plate: string }) {
  const glow = risk === 'high' ? '#d0254a' : risk === 'medium' ? '#f5a524' : '#0f9f6e';
  return (
    <svg viewBox="0 0 520 230" role="img" aria-label={`Camión ${plate}`}>
      <defs>
        <linearGradient id="box" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#e9e4ff" /></linearGradient>
        <linearGradient id="cab" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#8455ff" /><stop offset="1" stopColor="#4120b5" /></linearGradient>
        <linearGradient id="glass" x1="0" x2="1"><stop offset="0" stopColor="#7ed8f4" stopOpacity=".95" /><stop offset="1" stopColor="#a58dff" stopOpacity=".8" /></linearGradient>
        <linearGradient id="road" x1="0" x2="1"><stop offset="0" stopColor="#a58dff" stopOpacity="0" /><stop offset=".5" stopColor="#a58dff" stopOpacity=".35" /><stop offset="1" stopColor="#7ed8f4" stopOpacity="0" /></linearGradient>
        <radialGradient id="shadow"><stop offset="0" stopColor="#45359b" stopOpacity=".35" /><stop offset="1" stopColor="#45359b" stopOpacity="0" /></radialGradient>
      </defs>
      <rect x="0" y="196" width="520" height="6" rx="3" fill="url(#road)" />
      <ellipse cx="250" cy="196" rx="220" ry="14" fill="url(#shadow)" />
      {/* contenedor */}
      <rect x="40" y="42" width="290" height="132" rx="16" fill="url(#box)" stroke="#d9d1ff" strokeWidth="2" />
      <rect x="40" y="42" width="290" height="22" rx="11" fill="#ffffff" opacity=".9" />
      <path d="M58 150 H312" stroke="#e3dcff" strokeWidth="2" />
      <text x="62" y="112" fontSize="30" fontWeight="800" fill="#4120b5" fontFamily="Inter, system-ui" letterSpacing="2">NEXUS</text>
      <text x="64" y="134" fontSize="12" fontWeight="700" fill="#8a8fae" fontFamily="Inter, system-ui" letterSpacing="3">LOGISTICS OS</text>
      <rect x="236" y="88" width="76" height="40" rx="10" fill="#f4f1ff" stroke="#d9d1ff" />
      <text x="274" y="113" textAnchor="middle" fontSize="13" fontWeight="800" fill="#4120b5" fontFamily="ui-monospace, monospace">{plate}</text>
      {/* cabina */}
      <path d="M334 74 h78 c10 0 18 5 23 13 l32 52 c3 5 5 11 5 17 v18 h-138 z" fill="url(#cab)" />
      <path d="M350 88 h56 c6 0 11 3 14 8 l22 38 h-92 z" fill="url(#glass)" />
      <path d="M356 92 l30 0 l-20 38 h-10 z" fill="#ffffff" opacity=".35" />
      <rect x="455" y="150" width="20" height="10" rx="4" fill="#ffe9a8" />
      <rect x="336" y="160" width="134" height="8" rx="4" fill="#2e1689" />
      {/* ruedas */}
      {[110, 260, 420].map((cx) => (
        <g key={cx}><circle cx={cx} cy="180" r="24" fill="#1f1a3d" /><circle cx={cx} cy="180" r="11" fill="#d9d1ff" /><circle cx={cx} cy="180" r="4" fill="#4120b5" /></g>
      ))}
      {/* indicador de estado */}
      <circle cx="490" cy="40" r="14" fill={glow} opacity=".18"><animate attributeName="r" values="12;18;12" dur="2.4s" repeatCount="indefinite" /></circle>
      <circle cx="490" cy="40" r="7" fill={glow} />
    </svg>
  );
}

export function HeroPanel({ hero }: { hero: Hero | null }) {
  if (!hero) {
    return (
      <section className="glass hero" aria-label="Prioridad de transporte">
        <div className="panel-title">Prioridad de transporte</div>
        <p className="muted">No hay viajes en tránsito en el alcance seleccionado. Cuando un viaje salga, su seguimiento aparecerá aquí.</p>
      </section>
    );
  }
  const posAge = minutesAgo(hero.position?.at);
  const currentIdx = hero.stops.findIndex((s) => s.status !== 'done');
  const title = hero.risk === 'high' ? 'Prioridad: envío en riesgo' : hero.risk === 'medium' ? 'Atención: viaje con margen ajustado' : 'Viaje principal en tránsito';
  return (
    <section className="glass hero" aria-labelledby="hero-title">
      <div className="row between wrap">
        <div className="row" style={{ gap: 10 }}>
          <Status value={hero.risk} />
          <h2 id="hero-title" className="panel-title" style={{ color: 'var(--ink)' }}>{title}</h2>
        </div>
        <div className="row small muted"><Icon name="pin" size={14} /> Posición {hero.position?.source === 'simulator' ? 'simulada' : hero.position?.source ?? '—'} · {posAge === null ? 'sin señal' : agoLabel(hero.position!.at)}</div>
      </div>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 780 }}>{hero.code} <span className="muted" style={{ fontWeight: 600, fontSize: 15 }}>· {hero.originSite} → {hero.destination}</span></div>
        <div className="small muted">Ruta v{hero.routeVersion}: {hero.routeLabel} · {fmtNumber(hero.distanceKm, 1)} km</div>
      </div>
      <div className="hero-body">
        <div className="truck-stage"><TruckArt risk={hero.risk} plate={hero.vehicle?.plate ?? '—'} /></div>
        <div className="stats">
          <div className="stat"><div className="k">Conductor</div><div className="v">{hero.driver ?? 'Sin asignar'}</div></div>
          <div className="stat"><div className="k">Vehículo</div><div className="v">{hero.vehicle ? `${hero.vehicle.plate}` : '—'}</div><div className="tiny soft">{hero.vehicle?.model}</div></div>
          <div className="stat"><div className="k">A bordo</div><div className="v">{fmtNumber(hero.unitsOnBoard)} unidades</div><div className="tiny soft">{hero.shipments} guías · {hero.shipmentsAtRisk} en riesgo</div></div>
          <div className="stat"><div className="k">Velocidad · Combustible</div><div className="v">{hero.speedKmh ?? '—'} km/h · {hero.fuelPct ?? '—'} %</div><div className="tiny soft">telemetría simulada</div></div>
          <div className="stat" style={{ gridColumn: 'span 2' }}>
            <div className="k">ETA original vs. ETA revisada · ventana hasta {fmtTime(hero.windowEnd)}</div>
            <div className="v eta-compare">
              <span className={hero.delayMinutes > 0 ? 'strike' : ''}>{fmtTime(hero.plannedArrival)}</span>
              <Icon name="route" size={16} />
              <span style={{ color: hero.risk === 'high' ? 'var(--danger)' : 'var(--ink)' }}>{fmtTime(hero.eta)}</span>
              {hero.delayMinutes > 0 && <span className="status danger">+{hero.delayMinutes} min</span>}
            </div>
            <div className="tiny soft">Fuente ETA: {hero.etaSource === 'simulator' ? 'simulador DEMO' : hero.etaSource} · {agoLabel(hero.etaUpdatedAt)}{hero.delayCause ? ` · ${hero.delayCause}` : ''}</div>
          </div>
        </div>
      </div>
      <ol className="stops" aria-label="Paradas de la ruta">
        {hero.stops.map((s, i) => (
          <li key={s.seq} className={`stopn ${s.status === 'done' ? 'done' : ''} ${i === currentIdx ? 'current' : ''}`} style={{ listStyle: 'none' }}>
            <div className="dot" />
            <div style={{ fontWeight: 650 }}>{s.label}</div>
            <div className="tiny soft">{s.status === 'done' ? `✓ ${fmtTime(s.actual_at)}` : `plan ${fmtTime(s.planned_at)}`}</div>
          </li>
        ))}
      </ol>
      {hero.recommendation && (
        <div className="row between wrap" style={{ marginTop: 14 }}>
          <span className="small muted">Recomendación {hero.recommendation.code} · <Status value={hero.recommendation.status} /></span>
          <Link className="btn btn-primary" href={`/ia/aprobaciones/${hero.recommendation.id}`}><Icon name="sparkles" size={16} /> Revisar recomendaciones</Link>
        </div>
      )}
    </section>
  );
}

/* ---------------- Brief de operaciones IA (N.02.6) ---------------- */
const SEVERITY_ES: Record<string, string> = { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica' };
export function AIBrief({ brief, canSimulate, demo, onSimulate, busy }: { brief: Summary['brief']; canSimulate: boolean; demo: boolean;
  onSimulate: (kind: 'delay' | 'reset') => void; busy: boolean }) {
  return (
    <section className="glass brief" aria-labelledby="brief-title">
      <div className="row between">
        <div className="row" style={{ gap: 10 }}>
          <span className="ai-orb"><Icon name="sparkles" size={18} /></span>
          <div><h2 id="brief-title" style={{ fontSize: 16 }}>Brief de operaciones</h2><div className="tiny soft">NEXUS AI · motor de reglas determinista (sin proveedor de IA)</div></div>
        </div>
      </div>
      {brief.recommendations.length === 0 && <div className="alert info">No hay propuestas pendientes. Las recomendaciones aparecen cuando un agente detecta riesgo.</div>}
      {brief.recommendations.map((r) => (
        <article key={r.id} className="rec" aria-label={`Recomendación ${r.code}`}>
          <div className="row between wrap"><span className="small" style={{ fontWeight: 700 }}>{r.code} · Route Agent</span><Status value={r.severity} /></div>
          <div style={{ fontWeight: 650 }}>{r.summary}</div>
          <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>{r.causes.map((c) => <li key={c.code}>{c.text}</li>)}</ul>
          <div className="row between small"><span>Confianza {Math.round(r.confidence * 100)} %</span><Status value={r.data_quality} /></div>
          <div className="confidence" aria-hidden><span style={{ width: `${Math.round(r.confidence * 100)}%` }} /></div>
          <div className="small muted">{r.options.length} opciones · requiere aprobación humana</div>
          <Link className="btn btn-primary btn-sm" href={`/ia/aprobaciones/${r.id}`}>Revisar recomendaciones</Link>
        </article>
      ))}
      <div className="panel-title" style={{ marginTop: 4 }}>Novedades abiertas</div>
      <ul className="actions-list">
        {brief.exceptions.slice(0, 4).map((e) => (
          <li key={e.id}><Icon name="alert" size={16} /><div className="grow"><div className="small" style={{ fontWeight: 650 }}>{e.title}</div>
            <div className="tiny soft">{agoLabel(e.opened_at)}{e.trip_code ? ` · ${e.trip_code}` : ''}</div></div><Status value={e.severity === 'high' || e.severity === 'critical' ? 'high' : e.severity === 'medium' ? 'medium' : 'low'} label={SEVERITY_ES[e.severity] ?? e.severity} /></li>
        ))}
        {!brief.exceptions.length && <li className="small muted">Sin novedades abiertas.</li>}
      </ul>
      {demo && canSimulate && (
        <div className="stack" style={{ borderTop: '1px solid var(--hairline)', paddingTop: 10 }}>
          <div className="tiny soft">Simulador DEMO (sección 23.2): genera hechos a través de los mismos servicios, eventos y auditoría.</div>
          <div className="row wrap">
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onSimulate('delay')}><Icon name="play" size={14} /> Simular retraso</button>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onSimulate('reset')}><Icon name="refresh" size={14} /> Restablecer escenario</button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------------- Mapa esquemático (N.02.7) ---------------- */
const VIEWS = {
  valle: { label: 'Valle del Cauca', minLat: 3.3, maxLat: 3.98, minLon: -77.12, maxLon: -76.22 },
  nacional: { label: 'Red nacional', minLat: 2.9, maxLat: 11.4, minLon: -77.6, maxLon: -73.4 },
} as const;

export function RouteMap({ map }: { map: Summary['map'] }) {
  const [view, setView] = useState<keyof typeof VIEWS>('valle');
  const v = VIEWS[view];
  const W = 640, H = view === 'valle' ? 360 : 420;
  const proj = useMemo(() => (lat: number, lon: number): [number, number] => [
    ((lon - v.minLon) / (v.maxLon - v.minLon)) * W, H - ((lat - v.minLat) / (v.maxLat - v.minLat)) * H,
  ], [v, H]);
  const color = (r: string) => (r === 'high' ? '#d0254a' : r === 'medium' ? '#f5a524' : '#6d3df5');
  return (
    <section className="glass panel" aria-labelledby="map-title">
      <div className="row between wrap" style={{ marginBottom: 10 }}>
        <h2 id="map-title" className="panel-title">Mapa de red y rutas</h2>
        <div className="row" role="group" aria-label="Vista del mapa">
          {(Object.keys(VIEWS) as (keyof typeof VIEWS)[]).map((k) => (
            <button key={k} className={`btn btn-sm ${view === k ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={view === k} onClick={() => setView(k)}>{VIEWS[k].label}</button>
          ))}
        </div>
      </div>
      <div className="map-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Mapa esquemático ${v.label} con ${map.routes.length} rutas activas`}>
          <defs><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="rgba(109,61,245,.08)" /></pattern></defs>
          <rect width={W} height={H} fill="url(#grid)" />
          {map.routes.map((r) => {
            const pts = r.points.map(([la, lo]) => proj(la, lo));
            return <polyline key={r.tripId} points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={color(r.risk)} strokeWidth={r.risk === 'high' ? 4 : 2.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={r.risk === 'high' ? '0' : '6 6'} opacity=".85" />;
          })}
          {map.sites.map((s) => {
            const [x, y] = proj(s.lat, s.lon);
            if (x < -20 || x > W + 20 || y < -20 || y > H + 20) return null;
            return (
              <g key={s.id}>
                <circle cx={x} cy={y} r="9" fill="#fff" stroke="#6d3df5" strokeWidth="2.5" />
                <circle cx={x} cy={y} r="3.5" fill="#6d3df5" />
                <text x={x + 13} y={y + 4} fontSize="12.5" fontWeight="700" fill="currentColor" style={{ fill: 'var(--ink)' }}>{s.city}</text>
              </g>
            );
          })}
          {map.routes.filter((r) => r.vehicle).map((r) => {
            const [x, y] = proj(r.vehicle!.lat, r.vehicle!.lon);
            if (x < 0 || x > W || y < 0 || y > H) return null;
            return (
              <g key={`v-${r.tripId}`}>
                <title>{`${r.code} · posición ${r.vehicle!.source === 'simulator' ? 'simulada' : r.vehicle!.source} ${r.vehicle!.ageMin === null ? 'sin señal' : `hace ${r.vehicle!.ageMin} min`}`}</title>
                <circle cx={x} cy={y} r="13" fill={color(r.risk)} opacity=".18" />
                <rect x={x - 8} y={y - 6} width="16" height="12" rx="3" fill={color(r.risk)} stroke="#fff" strokeWidth="2" opacity={r.vehicle!.stale ? 0.45 : 1} />
                <text x={x} y={y - 14} fontSize="10.5" textAnchor="middle" fontWeight="700" style={{ fill: 'var(--ink-muted)' }}>{r.code}</text>
              </g>
            );
          })}
        </svg>
        <div className="map-legend glass solid">
          <span className="row" style={{ gap: 10 }}>
            <span className="row"><svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" stroke="#d0254a" strokeWidth="4" /></svg> en riesgo</span>
            <span className="row"><svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" stroke="#6d3df5" strokeWidth="2.5" strokeDasharray="4 3" /></svg> en tiempo</span>
          </span>
        </div>
      </div>
      <div className="tiny soft" style={{ marginTop: 8 }}>Mapa esquemático: sin proveedor de mapas configurado. Las posiciones y trazados son del simulador DEMO; no son GPS en vivo.</div>
    </section>
  );
}

/* ---------------- Cronograma de despachos + próximas acciones (N.02.8) ---------------- */
export function DispatchTimeline({ items, actions }: { items: Summary['timeline']; actions: Summary['nextActions'] }) {
  const now = Date.now();
  // Rango dinámico: cubre todos los viajes del día y la hora actual (mínimo 12 h), en horas locales de Colombia.
  const dayStart = useMemo(() => {
    const d = new Date(now - 5 * 3600000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + 5 * 3600000;
  }, [now]);
  const hOf = (t: string | number) => (new Date(t).getTime() - dayStart) / 3600000;
  const times = [now, ...items.flatMap((t) => [t.plannedDeparture, t.eta ?? t.plannedArrival])].map(hOf);
  let startH = Math.max(0, Math.floor(Math.min(...times)) - 1);
  let endH = Math.ceil(Math.max(...times)) + 1;
  if (endH - startH < 12) { const pad = 12 - (endH - startH); startH = Math.max(0, startH - Math.ceil(pad / 2)); endH = startH + 12; }
  const x = (t: string | number) => Math.min(100, Math.max(0, ((hOf(t) - startH) / (endH - startH)) * 100));
  const step = Math.max(1, Math.ceil((endH - startH) / 6));
  const hours = Array.from({ length: Math.floor((endH - startH) / step) + 1 }, (_, i) => startH + i * step);
  return (
    <section className="glass panel" aria-labelledby="tl-title">
      <h2 id="tl-title" className="panel-title">Cronograma de despachos de hoy</h2>
      <div className="tl" role="table" aria-label="Despachos del día">
        <div className="tl-axis" aria-hidden>{hours.map((h) => <span key={h}>{String(h % 24).padStart(2, '0')}:00{h >= 24 ? '⁺¹' : ''}</span>)}</div>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 112, right: 0, top: 0, bottom: 0, pointerEvents: 'none' }}>
            <div className="tl-now" style={{ left: `${x(now)}%` }}><span>ahora</span></div>
          </div>
          {items.slice(0, 9).map((t) => {
            const a = x(t.plannedDeparture), b = x(t.eta ?? t.plannedArrival);
            const cls = ['arrived', 'closed'].includes(t.status) ? 'done' : t.risk;
            return (
              <div className="tl-row" role="row" key={t.tripId}>
                <div className="tl-label" role="cell" title={t.label}>{t.code}</div>
                <div className="tl-track" role="cell" aria-label={`${t.label}: sale ${fmtTime(t.plannedDeparture)}, llega ${fmtTime(t.eta ?? t.plannedArrival)}, ${t.status}`}>
                  <div className={`tl-bar ${cls}`} style={{ left: `${a}%`, width: `${Math.max(1.5, b - a)}%` }} title={`${t.label} · ${fmtTime(t.plannedDeparture)} → ${fmtTime(t.eta ?? t.plannedArrival)}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <h3 className="panel-title" style={{ margin: '16px 0 8px' }}>Próximas acciones</h3>
      <ul className="actions-list">
        {actions.slice(0, 5).map((a, i) => (
          <li key={i}>
            <Icon name={a.kind === 'approval' ? 'sparkles' : a.kind === 'exception' ? 'alert' : 'truck'} size={16} />
            <div className="grow">
              <div className="small" style={{ fontWeight: 650 }}>{a.href ? <Link href={a.href}>{a.title}</Link> : a.title}</div>
              <div className="tiny soft">{a.owner}{a.dueAt ? ` · ${a.kind === 'approval' ? 'vence' : 'programado'} ${fmtTime(a.dueAt)}` : ''}</div>
            </div>
            <Status value={a.status === 'pending' ? 'pending_approval' : a.status} />
          </li>
        ))}
        {!actions.length && <li className="small muted">Sin acciones pendientes.</li>}
      </ul>
    </section>
  );
}
