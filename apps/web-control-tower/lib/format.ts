const TZ = 'America/Bogota';
const LOCALE = 'es-CO';

export function fmtTime(v: string | Date | null | undefined): string {
  if (!v) return '—';
  return new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(v));
}
export function fmtDateTime(v: string | Date | null | undefined): string {
  if (!v) return '—';
  return new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(v));
}
export function fmtNumber(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: digits }).format(n);
}
export function fmtCop(n: number): string {
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}
export function minutesAgo(v: string | Date | null | undefined, now = Date.now()): number | null {
  if (!v) return null;
  return Math.max(0, Math.round((now - new Date(v).getTime()) / 60000));
}
export function agoLabel(v: string | Date | null | undefined): string {
  const m = minutesAgo(v);
  if (m === null) return 'sin dato';
  if (m < 1) return 'hace instantes';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  return `hace ${h} h ${m % 60} min`;
}
/** Saludo según la hora en Colombia. */
export function greeting(now = new Date()): string {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }).format(now)) % 24;
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}
export function bogotaClock(now = new Date()): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }).format(now);
}
export function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}
