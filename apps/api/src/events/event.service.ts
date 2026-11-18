import { uuidv7 } from '@nexus/domain-core';
import type { Tx } from '../db/db.service';
import { chainHash } from '../common/crypto';
import type { RequestCtx } from '../auth/auth-context';

export interface NewEvent {
  eventType: string;
  entityType: string;
  entityId: string;
  /** Versión del agregado DESPUÉS del cambio */
  entityVersion: number;
  siteId?: string | null;
  payload: Record<string, unknown>;
  source?: 'api' | 'device' | 'worker' | 'simulator' | 'integration' | 'seed';
  occurredAt?: Date;
  causationId?: string | null;
  idempotencyKey?: string | null;
}

/**
 * Inserta el evento de dominio (append-only, cadena de hash por entidad) y su outbox
 * en la MISMA transacción del caso de uso (ADR-0006).
 */
export class EventService {
  async append(tx: Tx, ctx: Pick<RequestCtx, 'tenant' | 'actor' | 'correlationId'>, e: NewEvent): Promise<string> {
    const prev = await tx.query<{ integrity_hash: string }>(
      `SELECT integrity_hash FROM core.domain_event WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3
        ORDER BY entity_version DESC LIMIT 1`, [ctx.tenant.tenantId, e.entityType, e.entityId]);
    const id = uuidv7();
    const occurredAt = e.occurredAt ?? new Date();
    const operator = `${ctx.actor.kind}:${ctx.actor.id}`;
    const body = { id, event_type: e.eventType, entity_type: e.entityType, entity_id: e.entityId, entity_version: e.entityVersion,
      tenant_id: ctx.tenant.tenantId, operator_id: operator, occurred_at: occurredAt.toISOString(), payload: e.payload };
    const prevHash = prev.rows[0]?.integrity_hash ?? null;
    await tx.query(
      `INSERT INTO core.domain_event (id, tenant_id, event_type, schema_version, entity_type, entity_id, entity_version, site_id,
          operator_id, source, occurred_at, correlation_id, causation_id, idempotency_key, payload, prev_hash, integrity_hash)
       VALUES ($1,$2,$3,1,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [id, ctx.tenant.tenantId, e.eventType, e.entityType, e.entityId, e.entityVersion, e.siteId ?? null, operator,
       e.source ?? 'api', occurredAt, ctx.correlationId, e.causationId ?? null, e.idempotencyKey ?? null,
       JSON.stringify(e.payload), prevHash, chainHash(prevHash, body)],
    );
    await tx.query('INSERT INTO core.outbox_event (id, tenant_id) VALUES ($1, $2)', [id, ctx.tenant.tenantId]);
    return id;
  }
}
