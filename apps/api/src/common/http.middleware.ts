import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

/** correlation_id por petición + cabeceras de seguridad (D.4, S-HDR-01). */
export function securityAndCorrelation(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-correlation-id');
  const correlationId = incoming && /^[0-9a-f-]{36}$/i.test(incoming) ? incoming : randomUUID();
  (req as Request & { correlationId: string }).correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cache-Control', 'no-store');
  res.removeHeader('X-Powered-By');
  next();
}

/** Limitador simple en memoria por clave (login). Hito 10: mover a Redis/gateway. */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  constructor(private readonly max: number, private readonly windowMs: number) {}
  allow(key: string, now = Date.now()): boolean {
    const h = this.hits.get(key);
    if (!h || h.resetAt < now) { this.hits.set(key, { count: 1, resetAt: now + this.windowMs }); return true; }
    h.count++;
    return h.count <= this.max;
  }
}
