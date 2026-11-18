import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(__filename);

export default async function setup() {
  const { loadEnv } = require('../dist/config');
  loadEnv();
  const owner = process.env.TEST_DATABASE_OWNER_URL, app = process.env.TEST_DATABASE_URL;
  if (!owner || !app) throw new Error('Faltan TEST_DATABASE_OWNER_URL / TEST_DATABASE_URL (ejecute pnpm db:setup)');
  execFileSync('node', [join(__dirname, '..', '..', '..', 'database', 'migrate.mjs'), '--test'], { stdio: 'inherit' });
  const { seedDemo } = require('../dist/seed/seed');
  await seedDemo({ ownerUrl: owner, appUrl: app, reset: true, fixedPasswords: 'Prueba-Integracion-2026', allowRealReset: true });
}
