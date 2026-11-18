import { AppError } from '../common/errors';
import { sha256, canonical } from '../common/crypto';
import type { Tx } from '../db/db.service';

/**
 * Idempotencia de comandos (O.05): misma clave + mismo cuerpo ⇒ mismo resultado sin efecto nuevo;
 * misma clave + cuerpo distinto ⇒ 409 IDEMPOTENCY_MISMATCH.
 */
export class IdempotencyService {
  async run<T>(tx: Tx, tenantId: string, scope: string, key: string | undefined, request: unknown,
    fn: () => Promise<{ status: number; body: T }>): Promise<{ status: number; body: T; replayed: boolean }> {
    if (!key || !/^[A-Za-z0-9_.:-]{8,120}$/.test(key)) {
      throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Falta la cabecera Idempotency-Key (8–120 caracteres alfanuméricos).');
    }
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`idem:${tenantId}:${scope}:${key}`]);
    const requestHash = sha256(canonical(request));
    const prev = await tx.query<{ request_hash: string; response_status: number; response_body: T }>(
      'SELECT request_hash, response_status, response_body FROM core.idempotency_record WHERE tenant_id = $1 AND scope = $2 AND key = $3',
      [tenantId, scope, key]);
    const row = prev.rows[0];
    if (row) {
      if (row.request_hash !== requestHash) {
        throw new AppError(409, 'IDEMPOTENCY_MISMATCH', 'La Idempotency-Key ya se usó con otra solicitud distinta.');
      }
      return { status: row.response_status, body: row.response_body, replayed: true };
    }
    const result = await fn();
    await tx.query(
      'INSERT INTO core.idempotency_record (tenant_id, scope, key, request_hash, response_status, response_body) VALUES ($1,$2,$3,$4,$5,$6)',
      [tenantId, scope, key, requestHash, result.status, JSON.stringify(result.body)]);
    return { ...result, replayed: false };
  }
}
