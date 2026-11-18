import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from '../config';
import { seedDemo } from './seed';

async function main() {
  loadEnv();
  const ownerUrl = process.env.DATABASE_OWNER_URL, appUrl = process.env.DATABASE_URL;
  if (!ownerUrl || !appUrl) throw new Error('Faltan DATABASE_OWNER_URL / DATABASE_URL. Ejecute: pnpm db:setup');
  const reset = process.argv.includes('--reset');
  const { credentials } = await seedDemo({ ownerUrl, appUrl, reset });
  const file = join(__dirname, '..', '..', '..', '..', '.demo-credentials.local');
  const lines = [
    '# Credenciales DEMO generadas aleatoriamente por el seed. NO se commitean (.gitignore).',
    '# ENTORNO DEMO — DATOS SIMULADOS. Empresa ficticia: NEXUS DEMO COLOMBIA.',
    '',
    ...credentials.map((c) => `${c.tenant.padEnd(8)} ${c.role.padEnd(24)} ${c.email.padEnd(38)} ${c.password}   (${c.displayName}; sedes: ${c.sites})`),
    '',
  ];
  writeFileSync(file, lines.join('\n'), { mode: 0o600 });
  console.log(`✓ Seed DEMO creado (${credentials.length} usuarios). Credenciales en .demo-credentials.local`);
}

main().catch((err) => { console.error(`✗ ${err.message}`); process.exit(1); });
