import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Carga .env de la raíz del monorepo sin sobrescribir variables ya definidas. */
export function loadEnv(): void {
  const file = join(__dirname, '..', '..', '..', '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!;
  }
}

export interface AppConfig {
  databaseUrl: string;
  port: number;
  allowedOrigins: string[];
  sessionTtlMinutes: number;
  secureCookies: boolean;
  outboxIntervalMs: number;
  loginRateLimitMax: number;
}

export function readConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  loadEnv();
  const databaseUrl = overrides.databaseUrl ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Falta DATABASE_URL. Ejecute: pnpm db:setup');
  return {
    databaseUrl,
    port: Number(process.env.API_PORT ?? 4000),
    allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',').map((s) => s.trim()).filter(Boolean),
    sessionTtlMinutes: Number(process.env.SESSION_TTL_MINUTES ?? 480),
    secureCookies: process.env.NODE_ENV === 'production',
    outboxIntervalMs: Number(process.env.OUTBOX_INTERVAL_MS ?? 1000),
    loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 10),
    ...overrides,
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
