import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { login, ORIGIN, startApp } from './helpers';

let app: any; // eslint-disable-line @typescript-eslint/no-explicit-any
beforeAll(async () => { app = await startApp(); });
afterAll(async () => { await app?.close(); });

describe('Autenticación, sesión y CSRF (ADR-0005)', () => {
  it('credenciales inválidas ⇒ 401 con el mismo mensaje exista o no el usuario', async () => {
    const a = await request(app.getHttpServer()).post('/auth/login').set('origin', ORIGIN).send({ email: 'david@demo.nexus.local', password: 'incorrecta-123' });
    const b = await request(app.getHttpServer()).post('/auth/login').set('origin', ORIGIN).send({ email: 'nadie@demo.nexus.local', password: 'incorrecta-123' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.message_es).toBe(b.body.message_es);
  });

  it('login válido ⇒ cookie HttpOnly + empresa seleccionada automáticamente', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').set('origin', ORIGIN).send({ email: 'david@demo.nexus.local', password: 'Prueba-Integracion-2026' });
    expect(res.status).toBe(200);
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(cookies.find((c) => c.startsWith('nexus_sid='))).toMatch(/HttpOnly/i);
    const s = await login(app, 'david@demo.nexus.local');
    const me = await s.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.active.dataMode).toBe('demo');
    expect(me.body.active.roles).toEqual(['ops_director']);
  });

  it('sin sesión ⇒ 401 en /v1', async () => {
    const r = await request(app.getHttpServer()).get('/v1/dashboard/summary');
    expect(r.status).toBe(401);
    expect(r.body.code).toBe('UNAUTHENTICATED');
  });

  it('S-CSRF-01: POST sin token CSRF o con Origin ajeno ⇒ 403', async () => {
    const s = await login(app, 'david@demo.nexus.local');
    const noToken = await s.agent.post('/auth/logout').set('origin', ORIGIN).send({});
    expect(noToken.status).toBe(403);
    expect(noToken.body.code).toBe('CSRF_FAILED');
    const evil = await s.agent.post('/auth/logout').set('origin', 'https://evil.example').set('x-csrf-token', s.csrf).send({});
    expect(evil.status).toBe(403);
  });

  it('logout revoca la sesión en el servidor', async () => {
    const s = await login(app, 'david@demo.nexus.local');
    expect((await s.post('/auth/logout')).status).toBe(200);
    expect((await s.get('/auth/me')).status).toBe(401);
  });

  it('S-P0-07: un usuario desactivado pierde el acceso en la siguiente petición', async () => {
    const admin = await login(app, 'admin@demo.nexus.local');
    const email = `temporal.${Date.now()}@demo.nexus.local`;
    const created = await admin.post('/v1/users', { email, displayName: 'Usuario Temporal', roleCode: 'data_analyst', siteIds: [], initialPassword: 'Temporal-Segura-2026' });
    expect(created.status).toBe(201);
    const victim = await login(app, email, 'Temporal-Segura-2026');
    expect((await victim.get('/v1/dashboard/summary')).status).toBe(200);
    const off = await admin.post(`/v1/users/${created.body.id}/deactivate`);
    expect(off.status).toBe(200);
    expect(off.body.sessionsRevoked).toBeGreaterThanOrEqual(1);
    expect((await victim.get('/v1/dashboard/summary')).status).toBe(401);
  });

  it('SoD-05: un administrador de empresa no puede asignar security_admin ni platform_superadmin', async () => {
    const admin = await login(app, 'admin@demo.nexus.local');
    const r = await admin.post('/v1/users', { email: `x.${Date.now()}@demo.nexus.local`, displayName: 'Intento Escalada', roleCode: 'security_admin', siteIds: [], initialPassword: 'Temporal-Segura-2026' });
    expect(r.status).toBe(403);
  });

  it('S-HDR-01: cabeceras de seguridad presentes', async () => {
    const r = await request(app.getHttpServer()).get('/health/live');
    expect(r.headers['content-security-policy']).toContain("default-src 'none'");
    expect(r.headers['strict-transport-security']).toBeDefined();
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['x-powered-by']).toBeUndefined();
  });

  it('S-ERR-01: los errores no filtran trazas ni SQL y llevan correlation_id', async () => {
    const s = await login(app, 'david@demo.nexus.local');
    const r = await s.get('/v1/shipments/no-es-un-uuid');
    expect(r.status).toBe(404);
    expect(r.body.correlation_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(r.body)).not.toMatch(/stack|SELECT|at \w+ \(/);
    const v = await s.post('/v1/simulator/delay', { minutes: 'muchos' });
    expect(v.status).toBe(422);
    expect(v.body.code).toBe('VALIDATION_FAILED');
  });
});
