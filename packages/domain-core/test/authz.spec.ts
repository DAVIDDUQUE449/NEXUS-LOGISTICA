import { describe, it, expect } from 'vitest';
import { authorize, ROLES, PERMISSIONS, permissionsFor, type Subject } from '../src';

const base: Subject = { userId: 'u1', tenantId: 't1', roleCodes: [], siteIds: [], clientAccountIds: [], kind: 'user' };
const s = (o: Partial<Subject>): Subject => ({ ...base, ...o });

describe('authorize — RBAC + ABAC (MAPA_ROLES)', () => {
  it('niega por defecto a quien no tiene el permiso', () => {
    expect(authorize(s({ roleCodes: ['picker'] }), 'dashboard:read')).toEqual({ allow: false, reason: 'NO_PERMISSION' });
  });
  it('permite a un rol con el permiso', () => {
    expect(authorize(s({ roleCodes: ['transport_coordinator'] }), 'ai_recommendations:approve').allow).toBe(true);
  });
  it('recurso de otro tenant ⇒ OUT_OF_TENANT (la API responde 404)', () => {
    expect(authorize(s({ roleCodes: ['tenant_admin'] }), 'sites:read', { tenantId: 't2' })).toEqual({ allow: false, reason: 'OUT_OF_TENANT' });
  });
  it('sede fuera del alcance ⇒ denegado (D.3: operador de Norte no actúa en Sur)', () => {
    const sub = s({ roleCodes: ['transport_coordinator'], siteIds: ['norte'] });
    expect(authorize(sub, 'ai_recommendations:approve', { siteId: 'sur' })).toEqual({ allow: false, reason: 'OUT_OF_SITE_SCOPE' });
    expect(authorize(sub, 'ai_recommendations:approve', { siteId: 'norte' }).allow).toBe(true);
  });
  it('alcance vacío de sedes = todas las sedes del tenant', () => {
    expect(authorize(s({ roleCodes: ['ops_director'] }), 'trips:read', { siteId: 'cualquiera' }).allow).toBe(true);
  });
  it('cliente fuera del alcance ⇒ denegado (U26)', () => {
    expect(authorize(s({ roleCodes: ['client_user'], clientAccountIds: ['c1'] }), 'shipments:read', { clientAccountId: 'c2' }))
      .toEqual({ allow: false, reason: 'OUT_OF_CLIENT_SCOPE' });
  });
  it('un agente IA nunca obtiene permisos mutantes aunque tenga un rol que los incluya (SoD-07)', () => {
    expect(authorize(s({ roleCodes: ['tenant_admin'], kind: 'agent' }), 'ai_recommendations:approve'))
      .toEqual({ allow: false, reason: 'AGENT_CANNOT_MUTATE' });
    expect(authorize(s({ roleCodes: ['tenant_admin'], kind: 'agent' }), 'dashboard:read').allow).toBe(true);
  });
  it('no se autoaprueba lo que uno mismo creó (SoD-02)', () => {
    expect(authorize(s({ roleCodes: ['ops_director'] }), 'ai_recommendations:approve', { createdBy: 'u1' }))
      .toEqual({ allow: false, reason: 'SOD_SELF_APPROVAL' });
  });
  it('el auditor no tiene ningún permiso mutante (SoD-06)', () => {
    const p = permissionsFor(['auditor']);
    for (const m of ['sites:manage', 'users:manage', 'ai_recommendations:approve', 'simulator:operate'] as const) expect(p.has(m)).toBe(false);
  });
  it('todos los permisos de los roles existen en el catálogo', () => {
    for (const r of ROLES) for (const p of r.permissions) expect(PERMISSIONS).toContain(p);
  });
  it('los roles operativos móviles no acceden al Control Tower', () => {
    for (const code of ['picker', 'packer', 'sorter', 'courier', 'linehaul_driver', 'pudo_operator']) {
      expect(permissionsFor([code]).has('dashboard:read')).toBe(false);
    }
  });
});
