import { uuidv7 } from '@nexus/domain-core';
import type { DbService, Tx } from '../db/db.service';
import { chainHash } from '../common/crypto';
import type { RequestCtx } from '../auth/auth-context';

export interface AuditInput {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  decision: 'allow' | 'deny';
  reason?: string | null;
  before?: unknown;
  after?: unknown;
}

/** Campos que nunca se registran en claro (D.7). */
const REDACT = /pass(word)?|secret|token|otp|hash|csrf|cookie/i;
export function redact(v: unknown): unknown {
  if (v === null || v === undefined) return v ?? null;
  if (Array.isArray(v)) return v.map(redact);
  if (typeof v === 'object' && !(v instanceof Date)) {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, REDACT.test(k) ? '[REDACTADO]' : redact(x)]));
  }
  return v;
}

/** Auditoría append-only con cadena de hash por tenant (detecta manipulación; ADR-0006 §3). */
export class AuditService {
  constructor(private readonly db: DbService) {}

  async record(tx: Tx, ctx: Pick<RequestCtx, 'tenant' | 'actor' | 'correlationId' | 'ipHash'>, input: AuditInput): Promise<string> {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`audit:${ctx.tenant.tenantId}`]);
    const prev = await tx.query<{ integrity_hash: string }>(
      'SELECT integrity_hash FROM core.audit_entry WHERE tenant_id = $1 ORDER BY seq DESC LIMIT 1', [ctx.tenant.tenantId]);
    const id = uuidv7();
    const createdAt = new Date();
    const entry = {
      id, tenant_id: ctx.tenant.tenantId, actor_id: ctx.actor.id, actor_kind: ctx.actor.kind, actor_name: ctx.actor.name,
      action: input.action, resource_type: input.resourceType, resource_id: input.resourceId ?? null, decision: input.decision,
      reason: input.reason ?? null, before_redacted: redact(input.before) ?? null, after_redacted: redact(input.after) ?? null,
      correlation_id: ctx.correlationId, created_at: createdAt.toISOString(),
    };
    const prevHash = prev.rows[0]?.integrity_hash ?? null;
    await tx.query(
      `INSERT INTO core.audit_entry (id, tenant_id, actor_id, actor_kind, actor_name, action, resource_type, resource_id, decision, reason,
         before_redacted, after_redacted, correlation_id, ip_hash, created_at, prev_hash, integrity_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [id, entry.tenant_id, entry.actor_id, entry.actor_kind, entry.actor_name, entry.action, entry.resource_type, entry.resource_id,
       entry.decision, entry.reason, JSON.stringify(entry.before_redacted), JSON.stringify(entry.after_redacted), entry.correlation_id,
       ctx.ipHash ?? null, createdAt, prevHash, chainHash(prevHash, entry)],
    );
    return id;
  }

  /** Auditoría en su propia transacción (para denegaciones, que no deben depender del caso de uso). */
  async recordStandalone(ctx: Pick<RequestCtx, 'tenant' | 'actor' | 'correlationId' | 'ipHash'>, input: AuditInput): Promise<void> {
    await this.db.withTenant(ctx.tenant, (tx) => this.record(tx, ctx, input));
  }

  /** Verifica la cadena de hash del tenant. Devuelve el primer seq roto o null. */
  async verifyChain(tx: Tx, tenantId: string): Promise<{ ok: boolean; checked: number; brokenAt: number | null }> {
    const { rows } = await tx.query(
      `SELECT seq, id, tenant_id, actor_id, actor_kind, actor_name, action, resource_type, resource_id, decision, reason,
              before_redacted, after_redacted, correlation_id, created_at, prev_hash, integrity_hash
         FROM core.audit_entry WHERE tenant_id = $1 ORDER BY seq`, [tenantId]);
    let prev: string | null = null;
    for (const r of rows) {
      const entry = {
        id: r.id, tenant_id: r.tenant_id, actor_id: r.actor_id, actor_kind: r.actor_kind, actor_name: r.actor_name, action: r.action,
        resource_type: r.resource_type, resource_id: r.resource_id, decision: r.decision, reason: r.reason,
        before_redacted: r.before_redacted, after_redacted: r.after_redacted, correlation_id: r.correlation_id,
        created_at: new Date(r.created_at).toISOString(),
      };
      if (r.prev_hash !== prev || chainHash(prev, entry) !== r.integrity_hash) return { ok: false, checked: rows.length, brokenAt: Number(r.seq) };
      prev = r.integrity_hash;
    }
    return { ok: true, checked: rows.length, brokenAt: null };
  }
}
