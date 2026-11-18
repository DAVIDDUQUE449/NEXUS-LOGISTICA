'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icon } from '@/components/Icon';

/** Regla N.04: las secciones aún no implementadas se explican en lugar de simular funciones. */
const INFO: Record<string, { title: string; hito: number; scope: string[] }> = {
  operacion: { title: 'Operación integral', hito: 6, scope: ['Torre de control por sede con semáforo SLA', 'Alertas e incident room', 'Agenda de turnos', 'Tableros de capacidad'] },
  oms: { title: 'Cadena de suministro / OMS', hito: 7, scope: ['Pedidos multicanal idempotentes', 'Promesa de entrega y reservas', 'Abastecimiento, compras y ASN', 'Integraciones e-commerce'] },
  wms: { title: 'Almacenes / WMS', hito: 3, scope: ['Recibo ASN, inspección y cuarentena', 'Ubicaciones y slotting', 'Inventario como libro mayor (sin stock negativo)', 'Picking y packing con apps Nexus Pick / Nexus Pack', 'Conteos, ajustes con doble control y transferencias'] },
  parcel: { title: 'Mensajería y paquetería', hito: 4, scope: ['Guías y rótulos únicos', 'Recogidas y admisión', 'Clasificación en hubs (Nexus Sort)', 'Contenedores, manifiestos y cadena de custodia', 'Última milla, POD offline y PUDO (Hito 5)'] },
  tms: { title: 'Transporte / TMS', hito: 6, scope: ['Planificador de rutas', 'Viajes, manifiestos y reconciliación', 'Tracking con antigüedad de señal', 'Flota, patio y muelles (YMS)'] },
  'digital-twin': { title: 'Gemelo digital 3D', hito: 8, scope: ['Digital Twin Studio: racks, pallets, muelles y camiones', 'Parcel Hub 3D y Yard 3D', 'HUD Liquid Glass con inspector', 'Respaldo 2D para equipos modestos'] },
  finanzas: { title: 'Finanzas y CRM', hito: 7, scope: ['Recaudo COD, arqueo y conciliación (Hito 5)', 'Cotización y tarifas', 'Tickets, PQR e indemnizaciones', 'Facturación vía proveedor habilitado'] },
  bi: { title: 'Datos y BI', hito: 10, scope: ['Diccionario de KPI versionado', 'Tableros por rol y sede', 'Exportaciones CSV/XLSX/PDF con marca DEMO/REAL'] },
};

export default function PendingModule() {
  const { slug } = useParams<{ slug: string }>();
  const m = INFO[slug];
  if (!m) return <div className="alert error" style={{ marginTop: 20 }}>Sección no encontrada. <Link href="/">Volver al inicio</Link></div>;
  return (
    <div className="glass panel stack" style={{ marginTop: 22, maxWidth: 760 }}>
      <div className="row"><span className="ai-orb"><Icon name="layers" size={18} /></span><h1 style={{ fontSize: 22 }}>{m.title}</h1></div>
      <div className="alert info">Este módulo todavía no está implementado: se construye en el <b>Hito {m.hito}</b> del plan. No se muestran pantallas simuladas.</div>
      <div className="panel-title">Alcance previsto</div>
      <ul style={{ margin: 0, paddingLeft: 20 }}>{m.scope.map((s) => <li key={s}>{s}</li>)}</ul>
      <div className="small muted">Detalle en docs/product/PLAN_HITOS.md y docs/ux/SITEMAP.md del repositorio.</div>
      <div><Link className="btn btn-ghost" href="/">Volver al Command Center</Link></div>
    </div>
  );
}
