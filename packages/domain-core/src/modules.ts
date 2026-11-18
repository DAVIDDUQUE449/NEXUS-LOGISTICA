/** Módulos del producto (L.3) y el hito en que se vuelven funcionales (PLAN_HITOS). */
export interface ProductModule { code: string; name: string; hito: number; available: boolean }

export const PRODUCT_MODULES: readonly ProductModule[] = [
  { code: 'core', name: 'NEXUS Core', hito: 1, available: true },
  { code: 'control_tower', name: 'Command Center', hito: 2, available: true },
  { code: 'ai', name: 'Nexus AI (aprobaciones)', hito: 2, available: true },
  { code: 'wms', name: 'Nexus WMS', hito: 3, available: false },
  { code: 'parcel', name: 'Nexus Parcel', hito: 4, available: false },
  { code: 'lastmile', name: 'Nexus Last Mile', hito: 5, available: false },
  { code: 'pudo', name: 'Nexus PUDO', hito: 5, available: false },
  { code: 'tms', name: 'Nexus TMS', hito: 6, available: false },
  { code: 'yms', name: 'Nexus YMS', hito: 6, available: false },
  { code: 'fleet', name: 'Nexus Fleet', hito: 6, available: false },
  { code: 'oms', name: 'Nexus OMS', hito: 7, available: false },
  { code: 'finance', name: 'Nexus Finance', hito: 7, available: false },
  { code: 'crm', name: 'Nexus CRM', hito: 7, available: false },
  { code: 'twin', name: 'Nexus Digital Twin', hito: 8, available: false },
  { code: 'trust', name: 'Nexus Trust', hito: 9, available: false },
  { code: 'bi', name: 'Nexus BI', hito: 10, available: false },
];
