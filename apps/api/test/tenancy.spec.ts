import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asTenant, login, ownerSql, startApp, tenantIds } from './helpers';

let app: any; // eslint-disable-line @typescript-eslint/no-explicit-any
beforeAll(async () => { app = await startApp(); });
afterAll(async () => { await app?.close(); });

describe('Multiempresa y alcance por sede (U25, U43, D.3, S-P0-01)', () => {
  it('U25 (API): el administrador del tenant B recibe 404 al pedir un envío del tenant A', async () => {
    const t = await tenantIds();
    const aShipment = await asTenant(t['DEMO-CO']!, async (c) => (await c.query('SELECT id FROM parcel.shipment LIMIT 1')).rows[0].id);
    const b = await login(app, 'admin.b@demo-b.nexus.local');
    const r = await b.get(`/v1/shipments/${aShipment}`);
    expect(r.status).toBe(404);
    expect(r.body.code).toBe('NOT_FOUND');
    const list = await b.get('/v1/shipments');
    expect(list.body.items).toHaveLength(5);
    expect(list.body.items.every((s: { code: string }) => s.code.startsWith('B-'))).toBe(true);
  });

  it('el administrador del tenant B no puede seleccionar el contexto del tenant A', async () => {
    const t = await tenantIds();
    const b = await login(app, 'admin.b@demo-b.nexus.local');
    const r = await b.post('/auth/context', { tenantId: t['DEMO-CO'] });
    expect(r.status).toBe(404);
  });

  it('U43: un coordinador de Bogotá solo ve Bogotá (sedes, viajes y KPI)', async () => {
    const s = await login(app, 'transporte.bogota@demo.nexus.local');
    const me = await s.get('/auth/me');
    expect(me.body.active.sites.map((x: { code: string }) => x.code)).toEqual(['BOG-HUB']);
    const sum = await s.get('/v1/dashboard/summary');
    expect(sum.status).toBe(200);
    expect(sum.body.timeline.every((x: { code: string }) => x.code.startsWith('BOG'))).toBe(true);
    expect(sum.body.hero?.code ?? 'BOG').toMatch(/^BOG/);
  });

  it('D.3: el coordinador de Bogotá no accede a un viaje de Cali ni decide su recomendación (404)', async () => {
    const t = await tenantIds();
    const { trip, rec } = await asTenant(t['DEMO-CO']!, async (c) => ({
      trip: (await c.query(`SELECT id FROM tms.trip WHERE code = 'CAL-2026-0001'`)).rows[0].id,
      rec: (await c.query(`SELECT id, version FROM ai.recommendation ORDER BY created_at DESC LIMIT 1`)).rows[0],
    }));
    const s = await login(app, 'transporte.bogota@demo.nexus.local');
    expect((await s.get(`/v1/trips/${trip}`)).status).toBe(404);
    expect((await s.get(`/v1/ai/recommendations/${rec.id}`)).status).toBe(404);
    const d = await s.post(`/v1/ai/recommendations/${rec.id}/decide`, { version: rec.version, decision: 'approved', optionKey: 'keep_route' }, { 'Idempotency-Key': `bog-${Date.now()}` });
    expect(d.status).toBe(404);
  });

  it('el cambio de sede fuera del alcance es rechazado', async () => {
    const t = await tenantIds();
    const cali = await asTenant(t['DEMO-CO']!, async (c) => (await c.query(`SELECT id FROM core.site WHERE code = 'CLO-HUB'`)).rows[0].id);
    const s = await login(app, 'transporte.bogota@demo.nexus.local');
    expect((await s.post('/auth/context', { tenantId: t['DEMO-CO'], siteId: cali })).status).toBe(404);
  });

  it('RBAC: el auditor no puede aprobar (403) y la denegación queda auditada', async () => {
    const t = await tenantIds();
    const rec = await asTenant(t['DEMO-CO']!, async (c) => (await c.query(`SELECT id, version FROM ai.recommendation ORDER BY created_at DESC LIMIT 1`)).rows[0]);
    const s = await login(app, 'auditor@demo.nexus.local');
    const r = await s.post(`/v1/ai/recommendations/${rec.id}/decide`, { version: rec.version, decision: 'approved', optionKey: 'keep_route' }, { 'Idempotency-Key': `aud-${Date.now()}` });
    expect(r.status).toBe(403);
    const denies = await s.get('/v1/audit/events?decision=deny');
    expect(denies.body.items.some((e: { reason: string }) => /NO_PERMISSION \(ai_recommendations:approve\)/.test(e.reason))).toBe(true);
  });

  it('el simulador solo opera en empresas DEMO (403 DEMO_ONLY en una empresa REAL)', async () => {
    const o = await ownerSql();
    const tenant = (await o.query(`INSERT INTO core.tenant (code, legal_name, data_mode) VALUES ($1, 'Empresa Real de Prueba', 'real') RETURNING id`, [`REAL-${Date.now()}`])).rows[0].id;
    const { hashPassword } = require('../dist/common/crypto');
    const email = `real.${Date.now()}@real.nexus.local`;
    const userId = (await o.query('SELECT core.provision_user($1,$2,$3) AS id', [email, 'Admin Real', await hashPassword('Clave-Real-Segura-2026')])).rows[0].id;
    await o.query(`INSERT INTO core.membership (tenant_id, user_id, role_code) VALUES ($1,$2,'tenant_admin')`, [tenant, userId]);
    await o.end();
    const s = await login(app, email, 'Clave-Real-Segura-2026');
    const r = await s.post('/v1/simulator/delay', {});
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('DEMO_ONLY');
  });
});
