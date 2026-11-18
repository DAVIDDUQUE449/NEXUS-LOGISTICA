import { defineConfig } from '@playwright/test';

/**
 * E2E contra la app en ejecución (web en :3000 y API en :4000; ver README).
 * Usa el Chromium preinstalado si existe PLAYWRIGHT_CHROMIUM_PATH.
 */
export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'off',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
});
