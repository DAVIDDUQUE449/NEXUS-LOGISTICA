import { AppError } from './errors';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Un id mal formado se trata como inexistente (404), igual que uno de otro tenant. */
export function parseId(id: string, what = 'Recurso'): string {
  if (!UUID.test(id)) throw new AppError(404, 'NOT_FOUND', `${what} no encontrado`);
  return id;
}
export function clampLimit(v: unknown, def = 50, max = 200): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : def;
}
