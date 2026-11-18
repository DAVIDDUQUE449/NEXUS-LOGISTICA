#!/usr/bin/env node
// Ejecuta las migraciones SQL de database/migrations en orden, una sola vez cada una.
// Uso: node database/migrate.mjs [--test]   (--test usa TEST_DATABASE_OWNER_URL)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '..', 'apps', 'api', 'package.json'));
const { Client } = require('pg');

function loadEnv() {
  const file = join(here, '..', '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnv();
const isTest = process.argv.includes('--test');
const url = isTest ? process.env.TEST_DATABASE_OWNER_URL : process.env.DATABASE_OWNER_URL;
if (!url) {
  console.error('Falta DATABASE_OWNER_URL (o TEST_DATABASE_OWNER_URL con --test). Ejecute: pnpm db:setup');
  process.exit(1);
}

const client = new Client({ connectionString: url });
await client.connect();
await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
  name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
const dir = join(here, 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
let applied = 0;
for (const f of files) {
  const sql = readFileSync(join(dir, f), 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');
  const { rows } = await client.query('SELECT checksum FROM public.schema_migrations WHERE name = $1', [f]);
  if (rows[0]) {
    if (rows[0].checksum !== checksum) {
      console.error(`✗ La migración ${f} ya aplicada fue modificada. Cree una migración nueva en lugar de editarla.`);
      process.exit(1);
    }
    continue;
  }
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO public.schema_migrations (name, checksum) VALUES ($1, $2)', [f, checksum]);
    await client.query('COMMIT');
    applied++;
    console.log(`✓ ${f}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`✗ ${f}: ${err.message}`);
    process.exit(1);
  }
}
console.log(applied ? `${applied} migración(es) aplicada(s) en ${isTest ? 'nexus_test' : 'nexus'}.` : 'Base de datos al día.');
await client.end();
