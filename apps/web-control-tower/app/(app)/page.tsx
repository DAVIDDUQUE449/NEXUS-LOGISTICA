'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { agoLabel, firstName, greeting } from '@/lib/format';
import { useSession } from '@/lib/session';
import { Icon } from '@/components/Icon';
import { AIBrief, DispatchTimeline, HeroPanel, KpiGrid, RouteMap, type Summary } from '@/components/home';

export default function HomePage() {
  const { me, can } = useSession();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string>('');
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<Summary>('/v1/dashboard/summary'));
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo cargar el tablero.');
    }
  }, []);

  useEffect(() => {
    void load();
    const poll = setInterval(load, 60000);
    const onCtx = () => void load();
    window.addEventListener('nexus:context-changed', onCtx);
    // Tiempo real por SSE: cada evento de dominio del tenant refresca el tablero (agrupado).
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/v1/stream');
      es.onopen = () => setLive(true);
      es.onerror = () => setLive(false);
      es.addEventListener('domain-event', () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => { void load(); window.dispatchEvent(new Event('nexus:refresh')); }, 400);
      });
    } catch { setLive(false); }
    return () => { clearInterval(poll); window.removeEventListener('nexus:context-changed', onCtx); es?.close(); };
  }, [load]);

  const simulate = async (kind: 'delay' | 'reset') => {
    setBusy(true);
    setNotice('');
    try {
      if (kind === 'delay') {
        const r = await api<{ recommendationId: string | null; tripCode: string }>('/v1/simulator/delay', { body: { tripCode: 'CAL-2026-0001', minutes: 47 } });
        setNotice(r.recommendationId ? `Retraso simulado en ${r.tripCode}. El Route Agent generó una propuesta pendiente de aprobación.` : 'Retraso simulado.');
      } else {
        await api('/v1/simulator/reset', { body: {} });
        setNotice('Escenario restablecido: CAL-2026-0001 vuelve a la ruta base y a tiempo.');
      }
      await load();
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : 'No se pudo ejecutar la simulación.');
    } finally {
      setBusy(false);
    }
  };

  const name = me ? firstName(me.user.displayName) : '';
  return (
    <>
      <div className="welcome">
        <div>
          <h1>{greeting()}, {name} <span aria-hidden>👋</span></h1>
          <div className="muted">Esto necesita atención en tu operación logística hoy{data?.scope.siteName ? ` · ${data.scope.siteName}` : ''}</div>
        </div>
        <div className="row wrap">
          <span className="row small muted" aria-live="polite"><span className={`live-dot ${live ? '' : 'off'}`} /> {live ? 'En línea · tiempo real' : 'Reconectando… (actualización cada 60 s)'}</span>
          <span className="small muted">· Última sincronización {data ? agoLabel(data.generatedAt) : '—'}</span>
          <Link href="/modulo/digital-twin" className="btn btn-ghost btn-sm"><Icon name="cube" size={15} /> Bodega 3D</Link>
          <button className="btn btn-primary btn-sm" disabled title="La creación de guías y órdenes se habilita en los Hitos 4 y 7"><Icon name="package" size={15} /> Nueva guía / orden</button>
        </div>
      </div>
      {error && <div className="alert error" role="alert" style={{ marginBottom: 12 }}>{error} <button className="btn btn-sm btn-ghost" onClick={() => void load()}>Reintentar</button></div>}
      {notice && <div className="alert info" role="status" style={{ marginBottom: 12 }}>{notice}</div>}
      {!data ? <HomeSkeleton /> : (
        <>
          <KpiGrid kpis={data.kpis} />
          <div className="grid-main">
            <HeroPanel hero={data.hero} />
            <AIBrief brief={data.brief} canSimulate={can('simulator:operate')} demo={data.dataMode === 'demo'} onSimulate={simulate} busy={busy} />
          </div>
          <div className="grid-bottom">
            <RouteMap map={data.map} />
            <DispatchTimeline items={data.timeline} actions={data.nextActions} />
          </div>
        </>
      )}
    </>
  );
}

function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando tablero">
      <div className="kpis">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton" style={{ height: 118 }} />)}</div>
      <div className="grid-main"><div className="skeleton" style={{ height: 420 }} /><div className="skeleton" style={{ height: 420 }} /></div>
    </div>
  );
}
