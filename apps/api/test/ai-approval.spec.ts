import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { asTenant, login, startApp, tenantIds, type Session } from './helpers';

let app: any; // eslint-disable-line @typescript-eslint/no-explicit-any
let coord: Session;
let tenant: string;
beforeAll(async () => {
  app = await startApp();
  coord = await login(app, 'transporte.cali@demo.nexus.local');
  tenant = (await tenantIds())['DEMO-CO']!;
});
afterAll(async () => { await app?.close(); });

async function freshRecommendation() {
  expect((await coord.post('/v1/simulator/reset')).status).toBe(200);
  const r = await coord.post('/v1/simulator/delay', { tripCode: 'CAL-2026-0001', minutes: 47 });
  expect(r.status).toBe(200);
  expect(r.body.recommendationId).toBeTruthy();
  const rec = await coord.get(`/v1/ai/recommendations/${r.body.recommendationId}`);
  return rec.body as { id: string; version: number; options: { key: string }[]; canDecide: boolean };
}

describe('U23 — IA gobernada: propuesta → aprobación humana → ejecución única', () => {
  let rec: Awaited<ReturnType<typeof freshRecommendation>>;
  beforeEach(async () => { rec = await freshRecommendation(); });

  it('la propuesta del Route Agent tiene opciones, requiere aprobación y el coordinador puede decidir', () => {
    expect(rec.options.map((o) => o.key)).toEqual(['keep_route', 'reroute_via_cencar', 'resequence_stops']);
    expect(rec.canDecide).toBe(true);
  });

  it('sin Idempotency-Key ⇒ 400', async () => {
    const r = await coord.post(`/v1/ai/recommendations/${rec.id}/decide`, { version: rec.version, decision: 'approved', optionKey: 'reroute_via_cencar' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('versión obsoleta ⇒ 409 VERSION_CONFLICT', async () => {
    const r = await coord.post(`/v1/ai/recommendations/${rec.id}/decide`, { version: rec.version + 5, decision: 'approved', optionKey: 'reroute_via_cencar' }, { 'Idempotency-Key': `v-${Date.now()}` });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('VERSION_CONFLICT');
  });

  it('rechazar exige motivo (422) y deja la ruta igual', async () => {
    const bad = await coord.post(`/v1/ai/recommendations/${rec.id}/decide`, { version: rec.version, decision: 'rejected' }, { 'Idempotency-Key': `r-${Date.now()}` });
    expect(bad.status).toBe(422);
    const before = await asTenant(tenant, async (c) => (await c.query(`SELECT route_label, version FROM tms.trip WHERE code = 'CAL-2026-0001'`)).rows[0]);
    const ok = await coord.post(`/v1/ai/recommendations/${rec.id}/decide`, { version: rec.version, decision: 'rejected', comment: 'Prefiero esperar el reporte del conductor' }, { 'Idempotency-Key': `r2-${Date.now()}` });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('rejected');
    const after = await asTenant(tenant, async (c) => (await c.query(`SELECT route_label, version FROM tms.trip WHERE code = 'CAL-2026-0001'`)).rows[0]);
    expect(after).toEqual(before);
  });

  it('aprobar desvío ⇒ se ejecuta UNA vez; reintento con la misma clave es idempotente; otra clave ⇒ 409', async () => {
    const key = `ok-${Date.now()}`;
    const body = { version: rec.version, decision: 'approved', optionKey: 'reroute_via_cencar' };
    const r1 = await coord.post(`/v1/ai/recommendations/${rec.id}/decide`, body, { 'Idempotency-Key': key });
    expect(r1.status).toBe(200);
    expect(r1.body.status).toBe('executed');
    expect(r1.body.execution.route).toContain('Cencar');
    expect(r1.body.execution.risk_after).not.toBe('high');

    const r2 = await coord.post(`/v1/ai/recommendations/${rec.id}/decide`, body, { 'Idempotency-Key': key });
    expect(r2.status).toBe(200);
    expect(r2.headers['idempotent-replayed']).toBe('true');
    expect(r2.body).toEqual(r1.body);

    const r3 = await coord.post(`/v1/ai/recommendations/${rec.id}/decide`, body, { 'Idempotency-Key': `${key}-otra` });
    expect(r3.status).toBe(409);

    const mismatch = await coord.post(`/v1/ai/recommendations/${rec.id}/decide`, { ...body, optionKey: 'keep_route' }, { 'Idempotency-Key': key });
    expect(mismatch.status).toBe(409);
    expect(mismatch.body.code).toBe('IDEMPOTENCY_MISMATCH');

    const db = await asTenant(tenant, async (c) => ({
      executions: (await c.query(`SELECT count(*)::int AS n FROM ai.execution_result e JOIN ai.approval a ON a.id = e.approval_id WHERE a.recommendation_id = $1`, [rec.id])).rows[0].n,
      routeChanged: (await c.query(`SELECT count(*)::int AS n FROM core.domain_event WHERE event_type = 'RouteChanged' AND causation_id = $1`, [rec.id])).rows[0].n,
      trip: (await c.query(`SELECT route_label, risk_level FROM tms.trip WHERE code = 'CAL-2026-0001'`)).rows[0],
      exceptionOpen: (await c.query(`SELECT count(*)::int AS n FROM parcel.exception_case e JOIN tms.trip t ON t.id = e.trip_id WHERE t.code = 'CAL-2026-0001' AND e.status = 'open'`)).rows[0].n,
    }));
    expect(db.executions).toBe(1);
    expect(db.routeChanged).toBe(1);
    expect(db.trip.route_label).toContain('Cencar');
    expect(db.exceptionOpen).toBe(0);
  });

  it('si el viaje cambia después de la propuesta, la aprobación se invalida (409 RECOMMENDATION_EXPIRED)', async () => {
    await asTenant(tenant, async (c) => {
      await c.query(`UPDATE tms.trip SET version = version + 1 WHERE code = 'CAL-2026-0001'`);
      await c.query('COMMIT');
    });
    const r = await coord.post(`/v1/ai/recommendations/${rec.id}/decide`, { version: rec.version, decision: 'approved', optionKey: 'reroute_via_cencar' }, { 'Idempotency-Key': `ctx-${Date.now()}` });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('RECOMMENDATION_EXPIRED');
    const status = await asTenant(tenant, async (c) => (await c.query('SELECT status FROM ai.recommendation WHERE id = $1', [rec.id])).rows[0].status);
    expect(status).toBe('expired');
  });

  it('una nueva simulación caduca la propuesta pendiente anterior (una sola pendiente por viaje)', async () => {
    await coord.post('/v1/simulator/delay', { tripCode: 'CAL-2026-0001', minutes: 60 });
    const pending = await asTenant(tenant, async (c) => (await c.query(`SELECT count(*)::int AS n FROM ai.recommendation r JOIN tms.trip t ON t.id = r.entity_id WHERE t.code = 'CAL-2026-0001' AND r.status = 'pending_approval'`)).rows[0].n);
    expect(pending).toBe(1);
    const old = await coord.get(`/v1/ai/recommendations/${rec.id}`);
    expect(old.body.status).toBe('expired');
  });
});

describe('Auditoría, eventos y tiempo real', () => {
  it('la cadena de hash de auditoría del tenant es íntegra tras todas las operaciones', async () => {
    const admin = await login(app, 'admin@demo.nexus.local');
    const r = await admin.get('/v1/audit/verify');
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.checked).toBeGreaterThan(5);
  });

  it('el outbox publica solo al canal del tenant dueño del evento', async () => {
    const { OutboxPublisher } = require('../dist/events/outbox.publisher');
    const { DbService } = require('../dist/db/db.service');
    const ids = await tenantIds();
    const db = new DbService(process.env.TEST_DATABASE_URL!);
    const pub = new OutboxPublisher(db, 1000);
    const seen: Record<string, number> = { a: 0, b: 0 };
    pub.bus.on(`tenant:${ids['DEMO-CO']}`, () => seen.a!++);
    pub.bus.on(`tenant:${ids['DEMO-B']}`, () => seen.b!++);
    let n = 0, total = 0;
    do { n = await pub.tick(); total += n; } while (n > 0);
    await db.close();
    expect(total).toBeGreaterThan(0);
    expect(seen.a! + seen.b!).toBe(total);
    expect(seen.a).toBeGreaterThan(seen.b!);
  });
});
