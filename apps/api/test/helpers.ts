import { createRequire } from 'node:module';
import request from 'supertest';
import { Client } from 'pg';

const require = createRequire(__filename);
/* eslint-disable @typescript-eslint/no-explicit-any */
const { createApp } = require('../dist/bootstrap') as { createApp: (o: any, opts: any) => Promise<{ app: any }> };
const { loadEnv } = require('../dist/config');
loadEnv();

export const PASSWORD = 'Prueba-Integracion-2026';
export const ORIGIN = 'http://localhost:3000';

export async function startApp() {
  const { app } = await createApp({ databaseUrl: process.env.TEST_DATABASE_URL, allowedOrigins: [ORIGIN] }, { startOutbox: false, logger: false });
  await app.init();
  return app;
}

export interface Session { agent: request.Agent; csrf: string; get: (p: string) => request.Test; post: (p: string, body?: object, headers?: Record<string, string>) => request.Test }

export async function login(app: any, email: string, password = PASSWORD): Promise<Session> {
  const agent = request.agent(app.getHttpServer());
  const res = await agent.post('/auth/login').set('origin', ORIGIN).send({ email, password });
  if (res.status !== 200) throw new Error(`login ${email} → ${res.status} ${JSON.stringify(res.body)}`);
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const csrf = cookies.map((c) => c.match(/^nexus_csrf=([^;]+)/)?.[1]).find(Boolean)!;
  return {
    agent, csrf,
    get: (p) => agent.get(p),
    post: (p, body = {}, headers = {}) => {
      let r = agent.post(p).set('origin', ORIGIN).set('x-csrf-token', csrf);
      for (const [k, v] of Object.entries(headers)) r = r.set(k, v);
      return r.send(body);
    },
  };
}

/** Conexión directa como nexus_app (para probar RLS a nivel SQL). */
export async function appSql(): Promise<Client> {
  const c = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await c.connect();
  return c;
}

export async function ownerSql(): Promise<Client> {
  const c = new Client({ connectionString: process.env.TEST_DATABASE_OWNER_URL });
  await c.connect();
  return c;
}

export async function tenantIds(): Promise<Record<string, string>> {
  const c = await ownerSql();
  const rows = (await c.query(`SELECT id, code FROM core.tenant`)).rows;
  await c.end();
  return Object.fromEntries(rows.map((r) => [r.code, r.id]));
}

export async function asTenant<T>(tenantId: string, fn: (c: Client) => Promise<T>): Promise<T> {
  const c = await appSql();
  try {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
    return await fn(c);
  } finally {
    await c.query('ROLLBACK').catch(() => undefined);
    await c.end();
  }
}
