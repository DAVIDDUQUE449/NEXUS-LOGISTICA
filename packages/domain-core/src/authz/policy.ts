import { permissionsFor, type Permission } from './catalog';

/** Sujeto autenticado con su membresía activa en el tenant del contexto. */
export interface Subject {
  userId: string;
  tenantId: string;
  roleCodes: readonly string[];
  /** Sedes permitidas. Vacío = todas las sedes del tenant. */
  siteIds: readonly string[];
  /** Clientes contractuales permitidos. Vacío = sin restricción por cliente. */
  clientAccountIds: readonly string[];
  kind: 'user' | 'agent';
}

/** Atributos del recurso sobre el que se actúa (ABAC). */
export interface ResourceAttrs {
  tenantId?: string;
  siteId?: string | null;
  clientAccountId?: string | null;
  /** Para SoD: quién creó / solicitó el recurso */
  createdBy?: string | null;
}

export type Decision =
  | { allow: true }
  | { allow: false; reason: 'NO_PERMISSION' | 'OUT_OF_TENANT' | 'OUT_OF_SITE_SCOPE' | 'OUT_OF_CLIENT_SCOPE' | 'AGENT_CANNOT_MUTATE' | 'SOD_SELF_APPROVAL' };

const MUTATING = new Set<Permission>(['sites:manage', 'users:manage', 'ai_recommendations:approve', 'simulator:operate']);

/**
 * Evalúa RBAC + ABAC. Función pura: la usan guards de la API, workers y tests.
 * `OUT_OF_TENANT` debe traducirse a 404 por la API (no revelar existencia).
 */
export function authorize(subject: Subject, permission: Permission, resource: ResourceAttrs = {}): Decision {
  if (resource.tenantId !== undefined && resource.tenantId !== subject.tenantId) return { allow: false, reason: 'OUT_OF_TENANT' };
  if (subject.kind === 'agent' && MUTATING.has(permission)) return { allow: false, reason: 'AGENT_CANNOT_MUTATE' };
  if (!permissionsFor(subject.roleCodes).has(permission)) return { allow: false, reason: 'NO_PERMISSION' };
  if (resource.siteId && subject.siteIds.length > 0 && !subject.siteIds.includes(resource.siteId)) {
    return { allow: false, reason: 'OUT_OF_SITE_SCOPE' };
  }
  if (resource.clientAccountId && subject.clientAccountIds.length > 0 && !subject.clientAccountIds.includes(resource.clientAccountId)) {
    return { allow: false, reason: 'OUT_OF_CLIENT_SCOPE' };
  }
  if (permission === 'ai_recommendations:approve' && resource.createdBy && resource.createdBy === subject.userId) {
    return { allow: false, reason: 'SOD_SELF_APPROVAL' };
  }
  return { allow: true };
}

export function can(subject: Subject, permission: Permission, resource?: ResourceAttrs): boolean {
  return authorize(subject, permission, resource).allow;
}
