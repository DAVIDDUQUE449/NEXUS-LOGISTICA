'use client';

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown, readonly correlationId?: string) {
    super(message);
  }
}

function csrfToken(): string {
  const m = typeof document !== 'undefined' ? document.cookie.match(/(?:^|;\s*)nexus_csrf=([^;]+)/) : null;
  return m ? decodeURIComponent(m[1]!) : '';
}

/** Llamada a la API a través del proxy same-origin /api (las cookies HttpOnly viajan solas). */
export async function api<T>(path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  const method = init.method ?? (init.body !== undefined ? 'POST' : 'GET');
  const headers: Record<string, string> = { accept: 'application/json' };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (method !== 'GET') headers['x-csrf-token'] = csrfToken();
  if (init.idempotencyKey) headers['idempotency-key'] = init.idempotencyKey;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: init.body !== undefined ? JSON.stringify(init.body) : undefined, credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Sin conexión con el servidor. Revise su red e intente de nuevo.');
  }
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const d = (data ?? {}) as { code?: string; message_es?: string; details?: unknown; correlation_id?: string };
    throw new ApiError(res.status, d.code ?? 'HTTP_' + res.status, d.message_es ?? `Error ${res.status}`, d.details, d.correlation_id);
  }
  return data as T;
}

function safeJson(t: string): unknown {
  try { return JSON.parse(t); } catch { return null; }
}

export function newIdempotencyKey(prefix: string): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${rnd}`;
}
