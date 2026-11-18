import { describe, it, expect } from 'vitest';
import { appSql, asTenant, ownerSql, tenantIds } from './helpers';

describe('Base de datos: aislamiento y append-only (ADR-0004, ADR-0006)', () => {
  it('S-RLS-01: toda tabla con tenant_id tiene RLS habilitado y FORZADO, con política de tenant', async () => {
    const c = await ownerSql();
    const { rows } = await c.query(`
      SELECT n.nspname || '.' || cl.relname AS t, cl.relrowsecurity AS rls, cl.relforcerowsecurity AS forced,
             EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = n.nspname AND p.tablename = cl.relname AND p.policyname = 'tenant_isolation') AS has_policy
        FROM pg_class cl JOIN pg_namespace n ON n.oid = cl.relnamespace
       WHERE cl.relkind = 'r' AND n.nspname IN ('core','fleet','tms','parcel','ai')
         AND EXISTS (SELECT 1 FROM information_schema.columns col WHERE col.table_schema = n.nspname AND col.table_name = cl.relname AND col.column_name = 'tenant_id')`);
    await c.end();
    expect(rows.length).toBeGreaterThan(15);
    // Excepción documentada: core.session no concede ningún privilegio a nexus_app (se usa solo vía funciones SECURITY DEFINER).
    const EXEMPT = new Set(['core.session']);
    const bad = rows.filter((r) => !EXEMPT.has(r.t) && (!r.rls || !r.forced || !r.has_policy)).map((r) => r.t);
    expect(bad).toEqual([]);
  });

  it('fail closed: sin app.tenant_id fijado, la consulta falla en lugar de devolver datos', async () => {
    const c = await appSql();
    await expect(c.query('SELECT count(*) FROM parcel.shipment')).rejects.toThrow();
    await c.end();
  });

  it('U25 (SQL): el contexto del tenant A no ve envíos del tenant B', async () => {
    const t = await tenantIds();
    const bIds = await asTenant(t['DEMO-B']!, async (c) => (await c.query('SELECT id FROM parcel.shipment')).rows.map((r) => r.id));
    expect(bIds.length).toBe(5);
    const seenFromA = await asTenant(t['DEMO-CO']!, async (c) => (await c.query('SELECT count(*)::int AS n FROM parcel.shipment WHERE id = ANY($1)', [bIds])).rows[0].n);
    expect(seenFromA).toBe(0);
  });

  it('WITH CHECK: no se puede insertar una fila con el tenant_id de otra empresa', async () => {
    const t = await tenantIds();
    await expect(asTenant(t['DEMO-CO']!, (c) => c.query(
      `INSERT INTO core.site (tenant_id, code, name, kind, city, department, lat, lon) VALUES ($1,'X','X','hub','X','X',0,0)`, [t['DEMO-B']]))).rejects.toThrow(/row-level security/);
  });

  it('S-APP-01: auditoría y eventos son inmutables (UPDATE/DELETE rechazados)', async () => {
    const t = await tenantIds();
    await expect(asTenant(t['DEMO-CO']!, (c) => c.query(`UPDATE core.audit_entry SET reason = 'x'`))).rejects.toThrow(/APPEND_ONLY|permission denied/);
    await expect(asTenant(t['DEMO-CO']!, (c) => c.query(`DELETE FROM core.domain_event`))).rejects.toThrow(/APPEND_ONLY|permission denied/);
    // El dueño de las tablas tampoco puede alterarlas: con RLS forzado no ve filas, y el trigger bloquea si las viera.
    const o = await ownerSql();
    const r = await o.query(`UPDATE core.audit_entry SET reason = 'x'`).catch((e: Error) => e);
    expect(r instanceof Error ? /APPEND_ONLY/.test(r.message) : r.rowCount === 0).toBe(true);
    await o.end();
  });

  it('la app no puede leer la tabla de sesiones directamente (solo funciones SECURITY DEFINER)', async () => {
    const c = await appSql();
    await expect(c.query('SELECT * FROM core.session')).rejects.toThrow(/permission denied/);
    await c.end();
  });

  it('el rol de la app no tiene BYPASSRLS ni es superusuario', async () => {
    const c = await appSql();
    const r = (await c.query(`SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user`)).rows[0];
    await c.end();
    expect(r).toEqual({ rolbypassrls: false, rolsuper: false });
  });
});
