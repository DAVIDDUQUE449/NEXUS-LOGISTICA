import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const creds = readFileSync(join(__dirname, '..', '..', '.demo-credentials.local'), 'utf8');
const password = (email: string) => creds.split('\n').find((l) => l.includes(` ${email} `))!.trim().split(/\s+/)[3]!;

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password(email));
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Buen(os|as) (días|tardes|noches)/);
}

test('credenciales inválidas muestran un error claro', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Correo').fill('david@demo.nexus.local');
  await page.getByLabel('Contraseña').fill('incorrecta-123');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.locator('.alert.error')).toContainText('Correo o contraseña incorrectos');
});

test('sin sesión, el Command Center redirige al login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});

test('N.02: inicio con franja DEMO, seis KPI con definición, prioridad, brief IA, mapa y cronograma', async ({ page }) => {
  await login(page, 'david@demo.nexus.local');
  await expect(page.getByText('ENTORNO DEMO — DATOS SIMULADOS')).toBeVisible();
  await expect(page.locator('.kpi')).toHaveCount(6);
  for (const label of ['Envíos activos', 'Unidades en tránsito', 'Entregados hoy', 'Retrasados', 'En riesgo', 'Novedades']) {
    await expect(page.locator('.kpi', { hasText: label })).toBeVisible();
  }
  await page.locator('.kpi', { hasText: 'Retrasados' }).click();
  await expect(page.getByRole('region', { name: /Definición de Retrasados/ })).toContainText('Denominador');
  await expect(page.getByRole('heading', { name: 'Brief de operaciones' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Mapa esquemático/ })).toBeVisible();
  await expect(page.getByText('Cronograma de despachos de hoy')).toBeVisible();
});

test('U23 en la UI: simular retraso → revisar propuesta → aprobar desvío → el inicio refleja la nueva ruta', async ({ page }) => {
  await login(page, 'transporte.cali@demo.nexus.local');
  await page.getByRole('button', { name: 'Restablecer escenario' }).click();
  await expect(page.getByRole('status')).toContainText('Escenario restablecido');
  await page.getByRole('button', { name: 'Simular retraso' }).click();
  await expect(page.getByRole('status')).toContainText('propuesta pendiente de aprobación');
  await expect(page.locator('.hero')).toContainText('Riesgo alto');

  await page.locator('.hero').getByRole('link', { name: 'Revisar recomendaciones' }).click();
  await expect(page.getByText('Comparar opciones · antes / después')).toBeVisible();
  await page.getByRole('radio', { name: /Desviar por la vía Cencar/ }).check();
  await page.getByRole('button', { name: 'Aprobar opción seleccionada' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByRole('status')).toContainText('ejecutada una sola vez');
  await expect(page.locator('.page-head')).toContainText('Ejecutada');

  await page.goto('/');
  await expect(page.locator('.hero')).toContainText('Cencar');
  await expect(page.locator('.hero')).not.toContainText('Riesgo alto');
});

test('RBAC en la UI: el auditor ve las propuestas pero no puede decidir; no ve el simulador', async ({ page }) => {
  await login(page, 'transporte.cali@demo.nexus.local');
  await page.getByRole('button', { name: 'Simular retraso' }).click();
  await expect(page.getByRole('status')).toContainText('propuesta pendiente');
  await page.getByRole('button', { name: 'Menú de usuario' }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login/);

  await login(page, 'auditor@demo.nexus.local');
  await expect(page.getByRole('button', { name: 'Simular retraso' })).toHaveCount(0);
  await page.goto('/ia/aprobaciones');
  await page.getByRole('button', { name: 'Pendientes' }).click();
  await page.locator('table.data a').first().click();
  await expect(page.getByText('bloqueado por permisos')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aprobar opción seleccionada' })).toHaveCount(0);
});

test('U44 (parcial): a 360 px no hay desplazamiento horizontal y los KPI se reorganizan en 2 columnas', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await login(page, 'david@demo.nexus.local');
  await expect(page.locator('.kpi')).toHaveCount(6);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const tops = await page.locator('.kpi').evaluateAll((els) => els.slice(0, 2).map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(tops[0]).toBe(tops[1]);
});

test.afterAll(async ({ browser }) => {
  // Deja el escenario DEMO en su estado inicial (retraso detectado con propuesta pendiente).
  const page = await browser.newPage();
  await login(page, 'transporte.cali@demo.nexus.local');
  await page.getByRole('button', { name: 'Restablecer escenario' }).click();
  await expect(page.getByRole('status')).toContainText('restablecido');
  await page.getByRole('button', { name: 'Simular retraso' }).click();
  await expect(page.getByRole('status')).toContainText('propuesta pendiente');
  await page.close();
});
