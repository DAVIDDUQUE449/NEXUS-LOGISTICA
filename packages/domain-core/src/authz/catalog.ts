/**
 * Catálogo de permisos y roles (docs/product/MAPA_ROLES.md).
 * Los permisos son `recurso:acción`. Solo se incluyen los que existen en el código actual;
 * cada hito añade los de su vertical slice.
 */
export const PERMISSIONS = [
  'dashboard:read',
  'sites:read',
  'sites:manage',
  'users:read',
  'users:manage',
  'audit:read',
  'shipments:read',
  'trips:read',
  'ai_recommendations:read',
  'ai_recommendations:approve',
  'simulator:operate',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type RiskLevel = 'R0' | 'R1' | 'R2' | 'R3' | 'R4';

/** Nivel de riesgo de cada permiso (MAPA_ROLES §1.2). */
export const PERMISSION_RISK: Record<Permission, RiskLevel> = {
  'dashboard:read': 'R0',
  'sites:read': 'R0',
  'sites:manage': 'R2',
  'users:read': 'R0',
  'users:manage': 'R3',
  'audit:read': 'R0',
  'shipments:read': 'R0',
  'trips:read': 'R0',
  'ai_recommendations:read': 'R0',
  'ai_recommendations:approve': 'R3',
  'simulator:operate': 'R1',
};

export interface RoleDefinition {
  code: string;
  name: string;
  mfaRequired: boolean;
  /** Interfaz principal según N.05 */
  interface: 'desktop' | 'mobile' | 'portal' | 'console' | 'public' | 'service';
  permissions: readonly Permission[];
}

const READ_OPS: Permission[] = ['dashboard:read', 'sites:read', 'shipments:read', 'trips:read', 'ai_recommendations:read'];

export const ROLES: readonly RoleDefinition[] = [
  { code: 'platform_superadmin', name: 'Superadmin de plataforma', mfaRequired: true, interface: 'desktop', permissions: ['sites:read'] },
  { code: 'tenant_admin', name: 'Administrador de empresa', mfaRequired: true, interface: 'desktop',
    permissions: [...READ_OPS, 'sites:manage', 'users:read', 'users:manage', 'audit:read', 'simulator:operate'] },
  { code: 'executive', name: 'Gerencia empresarial', mfaRequired: true, interface: 'desktop', permissions: [...READ_OPS] },
  { code: 'ops_director', name: 'Director de operaciones', mfaRequired: true, interface: 'desktop',
    permissions: [...READ_OPS, 'users:read', 'audit:read', 'ai_recommendations:approve', 'simulator:operate'] },
  { code: 'warehouse_coordinator', name: 'Coordinador de almacén', mfaRequired: true, interface: 'desktop',
    permissions: [...READ_OPS, 'ai_recommendations:approve'] },
  { code: 'receiving_clerk', name: 'Auxiliar de recepción', mfaRequired: false, interface: 'mobile', permissions: [] },
  { code: 'picker', name: 'Picker', mfaRequired: false, interface: 'mobile', permissions: [] },
  { code: 'packer', name: 'Packer', mfaRequired: false, interface: 'mobile', permissions: [] },
  { code: 'sorter', name: 'Clasificador de hub', mfaRequired: false, interface: 'mobile', permissions: [] },
  { code: 'forklift_operator', name: 'Montacarguista', mfaRequired: false, interface: 'mobile', permissions: [] },
  { code: 'transport_coordinator', name: 'Coordinador de transporte', mfaRequired: true, interface: 'desktop',
    permissions: [...READ_OPS, 'ai_recommendations:approve', 'simulator:operate'] },
  { code: 'yard_supervisor', name: 'Supervisor de patio', mfaRequired: false, interface: 'desktop', permissions: ['dashboard:read', 'sites:read', 'trips:read'] },
  { code: 'fleet_maintenance', name: 'Mantenimiento de flota', mfaRequired: false, interface: 'desktop',
    permissions: ['dashboard:read', 'sites:read', 'trips:read', 'ai_recommendations:read'] },
  { code: 'linehaul_driver', name: 'Conductor troncal', mfaRequired: false, interface: 'mobile', permissions: [] },
  { code: 'courier', name: 'Mensajero / domiciliario', mfaRequired: false, interface: 'mobile', permissions: [] },
  { code: 'pudo_operator', name: 'Encargado punto PUDO', mfaRequired: false, interface: 'mobile', permissions: [] },
  { code: 'customer_service', name: 'Atención al cliente', mfaRequired: false, interface: 'desktop',
    permissions: ['dashboard:read', 'sites:read', 'shipments:read', 'ai_recommendations:read'] },
  { code: 'finance', name: 'Finanzas', mfaRequired: true, interface: 'desktop', permissions: ['dashboard:read', 'sites:read', 'shipments:read'] },
  { code: 'data_analyst', name: 'Analista de datos', mfaRequired: false, interface: 'desktop', permissions: [...READ_OPS] },
  { code: 'auditor', name: 'Auditor / compliance', mfaRequired: true, interface: 'desktop',
    permissions: ['dashboard:read', 'sites:read', 'audit:read', 'ai_recommendations:read', 'users:read'] },
  { code: 'security_admin', name: 'Seguridad / TI', mfaRequired: true, interface: 'console', permissions: ['sites:read', 'audit:read', 'users:read'] },
  { code: 'client_admin', name: 'Cliente empresarial (administrador)', mfaRequired: true, interface: 'portal', permissions: ['shipments:read'] },
  { code: 'client_user', name: 'Cliente empresarial (usuario)', mfaRequired: false, interface: 'portal', permissions: ['shipments:read'] },
];

export const ROLE_BY_CODE: ReadonlyMap<string, RoleDefinition> = new Map(ROLES.map((r) => [r.code, r]));

export function permissionsFor(roleCodes: readonly string[]): Set<Permission> {
  const out = new Set<Permission>();
  for (const code of roleCodes) for (const p of ROLE_BY_CODE.get(code)?.permissions ?? []) out.add(p);
  return out;
}
