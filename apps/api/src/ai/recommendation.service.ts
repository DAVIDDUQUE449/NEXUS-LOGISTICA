import { authorize, evaluateTripRisk, proposeReroute, recommendationMachine, type RecommendationStatus } from '@nexus/domain-core';
import type { DecideRecommendationRequest } from '@nexus/shared-contracts';
import type { DbService, Tx } from '../db/db.service';
import type { AuditService } from '../audit/audit.service';
import type { EventService } from '../events/event.service';
import type { IdempotencyService } from '../events/idempotency.service';
import type { RequestCtx } from '../auth/auth-context';
import { AppError } from '../common/errors';
import { loadTrip, toSnapshot, insertStops, type TripRow } from '../operations/trip.repo';
import { SCENARIOS } from '../simulator/scenarios';

export interface RecommendationRow {
  id: string; tenant_id: string; site_id: string; code: string; version: number; agent: string; engine: string; mode: string;
  entity_type: string; entity_id: string; entity_version: number; severity: string; summary: string; causes: unknown;
  evidence: unknown; options: Option[]; confidence: string; data_quality: string; requires_approval: boolean;
  status: RecommendationStatus; expires_at: Date; created_at: Date; decided_at: Date | null;
}
interface Option { key: string; label: string; routeLabel: string; impact: { etaIso: string; delayVsWindowMin: number; extraKm: number; costCop: number }; risks: string[] }

const AGENT_ACTOR = (agent: string) => ({ id: `${agent}`, kind: 'agent' as const, name: `${agent[0]!.toUpperCase()}${agent.slice(1)} Agent (motor de reglas)` });

/**
 * IA gobernada (ADR-0009): el agente solo PROPONE; un humano autorizado decide; el servidor revalida
 * y ejecuta el caso de uso de dominio de forma idempotente. Ninguna herramienta del agente escribe en BD.
 */
export class RecommendationService {
  constructor(private readonly db: DbService, private readonly audit: AuditService, private readonly events: EventService,
    private readonly idem: IdempotencyService) {}

  /** Route Agent (RuleEngine): crea una propuesta para un viaje en riesgo. Devuelve el id o null. */
  async proposeForTrip(tx: Tx, ctx: Pick<RequestCtx, 'tenant' | 'correlationId' | 'dataMode'>, trip: TripRow, now = new Date()): Promise<string | null> {
    const scenario = SCENARIOS[trip.code];
    const draft = proposeReroute(toSnapshot(trip), scenario?.alternatives ?? [], now);
    if (!draft) return null;
    const agentCtx = { tenant: ctx.tenant, correlationId: ctx.correlationId, actor: AGENT_ACTOR('route') };
    // Caduca propuestas pendientes anteriores sobre la misma entidad (contexto cambió).
    const old = await tx.query<{ id: string; version: number }>(
      `UPDATE ai.recommendation SET status = 'expired', version = version + 1, decided_at = now() WHERE entity_id = $1 AND agent = 'route' AND status = 'pending_approval' RETURNING id, version`, [trip.id]);
    for (const o of old.rows) {
      await this.events.append(tx, agentCtx, { eventType: 'AISuggestionExpired', entityType: 'ai_recommendation', entityId: o.id, entityVersion: o.version,
        siteId: trip.origin_site_id, payload: { reason: 'context_changed' }, source: 'worker' });
    }
    const seq = (await tx.query<{ n: number }>('SELECT count(*)::int + 1 AS n FROM ai.recommendation')).rows[0]!.n;
    const code = `REC-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(seq).padStart(4, '0')}`;
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO ai.recommendation (tenant_id, site_id, code, agent, engine, mode, entity_type, entity_id, entity_version, severity, summary,
          causes, evidence, options, confidence, data_quality, requires_approval, status, expires_at)
       VALUES ($1,$2,$3,'route','rules:v1',$4,'trip',$5,$6,$7,$8,$9,$10,$11,$12,$13,true,'pending_approval',$14) RETURNING id`,
      [ctx.tenant.tenantId, trip.origin_site_id, code, ctx.dataMode, trip.id, trip.version, draft.severity, draft.summary,
       JSON.stringify(draft.causes), JSON.stringify(draft.evidence), JSON.stringify(draft.options), draft.confidence, draft.dataQuality, draft.expiresAt]);
    const id = rows[0]!.id;
    await this.events.append(tx, agentCtx, { eventType: 'AISuggestionCreated', entityType: 'ai_recommendation', entityId: id, entityVersion: 1,
      siteId: trip.origin_site_id, payload: { code, trip_code: trip.code, severity: draft.severity, options: draft.options.map((o) => o.key) }, source: 'worker' });
    await this.audit.record(tx, agentCtx, { action: 'ai.recommendation.propose', resourceType: 'ai_recommendation', resourceId: id, decision: 'allow',
      after: { code, trip: trip.code, severity: draft.severity, data_quality: draft.dataQuality } });
    return id;
  }

  async list(ctx: RequestCtx, status?: string) {
    return this.db.withTenant(ctx.tenant, async (tx) => {
      const { rows } = await tx.query(
        `SELECT r.id, r.code, r.version, r.agent, r.engine, r.mode, r.severity, r.summary, r.confidence::float, r.data_quality, r.status,
                r.expires_at, r.created_at, r.decided_at, r.entity_type, r.entity_id, t.code AS trip_code, s.name AS site_name
           FROM ai.recommendation r LEFT JOIN tms.trip t ON t.id = r.entity_id JOIN core.site s ON s.id = r.site_id
          WHERE ($1::text IS NULL OR r.status = $1) AND (cardinality($2::uuid[]) = 0 OR r.site_id = ANY($2))
          ORDER BY (r.status = 'pending_approval') DESC, r.created_at DESC LIMIT 100`, [status ?? null, ctx.subject.siteIds]);
      return { items: rows };
    });
  }

  async get(ctx: RequestCtx, id: string) {
    return this.db.withTenant(ctx.tenant, async (tx) => {
      const r = (await tx.query<RecommendationRow>('SELECT * FROM ai.recommendation WHERE id = $1', [id])).rows[0];
      if (!r || !authorize(ctx.subject, 'ai_recommendations:read', { siteId: r.site_id }).allow) throw new AppError(404, 'NOT_FOUND', 'Recomendación no encontrada');
      const trip = r.entity_type === 'trip' ? await loadTrip(tx, { id: r.entity_id }) : null;
      const approvals = (await tx.query('SELECT decision, option_key, approver_name, comment, created_at, recommendation_version FROM ai.approval WHERE recommendation_id = $1 ORDER BY created_at', [id])).rows;
      const execution = (await tx.query('SELECT e.status, e.result, e.created_at FROM ai.execution_result e JOIN ai.approval a ON a.id = e.approval_id WHERE a.recommendation_id = $1', [id])).rows[0] ?? null;
      return {
        ...r, confidence: Number(r.confidence),
        trip: trip && { id: trip.id, code: trip.code, version: trip.version, routeLabel: trip.route_label, eta: trip.eta, windowEnd: trip.window_end,
          plannedArrival: trip.planned_arrival, delayMinutes: trip.delay_minutes, status: trip.status, unitsOnBoard: trip.units_on_board },
        contextChanged: !!trip && trip.version !== r.entity_version,
        approvals, execution,
        canDecide: r.status === 'pending_approval' && authorize(ctx.subject, 'ai_recommendations:approve', { siteId: r.site_id }).allow,
      };
    });
  }

  /**
   * Decisión humana. Flujo: idempotencia → bloqueo → permiso ABAC → versión → vigencia → revalidación del
   * contexto en servidor → aprobación → ejecución única → eventos → auditoría.
   */
  async decide(ctx: RequestCtx, id: string, input: DecideRecommendationRequest, idempotencyKey: string | undefined) {
    return this.db.withTenant(ctx.tenant, (tx) => this.idem.run(tx, ctx.tenant.tenantId, `ai.decide:${id}`, idempotencyKey, input, async () => {
      const rec = (await tx.query<RecommendationRow>('SELECT * FROM ai.recommendation WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!rec) throw new AppError(404, 'NOT_FOUND', 'Recomendación no encontrada');
      const decision = authorize(ctx.subject, 'ai_recommendations:approve', { siteId: rec.site_id });
      if (!decision.allow) {
        // Se responde (y se confirma la transacción) para que la denegación quede auditada.
        await this.audit.record(tx, ctx, { action: 'ai.recommendation.decide', resourceType: 'ai_recommendation', resourceId: id, decision: 'deny', reason: decision.reason });
        return decision.reason === 'OUT_OF_SITE_SCOPE'
          ? { status: 404, body: { code: 'NOT_FOUND', message_es: 'Recomendación no encontrada', correlation_id: ctx.correlationId } as Record<string, unknown> }
          : { status: 403, body: { code: 'FORBIDDEN', message_es: 'No puede decidir esta recomendación.', correlation_id: ctx.correlationId } as Record<string, unknown> };
      }
      if (rec.version !== input.version) throw new AppError(409, 'VERSION_CONFLICT', 'La recomendación cambió. Recargue para ver la versión vigente.');
      if (rec.status !== 'pending_approval') throw new AppError(409, 'INVALID_TRANSITION', `La recomendación ya está en estado «${rec.status}».`);

      const expire = async (reason: string) => {
        await tx.query(`UPDATE ai.recommendation SET status = 'expired', version = version + 1, decided_at = now() WHERE id = $1`, [id]);
        await this.events.append(tx, ctx, { eventType: 'AISuggestionExpired', entityType: 'ai_recommendation', entityId: id, entityVersion: rec.version + 1, siteId: rec.site_id, payload: { reason } });
        await this.audit.record(tx, ctx, { action: 'ai.recommendation.expire', resourceType: 'ai_recommendation', resourceId: id, decision: 'allow', reason });
        return { status: 409, body: { code: 'RECOMMENDATION_EXPIRED', message_es: reason, correlation_id: ctx.correlationId } as Record<string, unknown> };
      };
      if (rec.expires_at.getTime() < Date.now()) return expire('La propuesta venció. Solicite una nueva evaluación.');

      const trip = await loadTrip(tx, { id: rec.entity_id }, true);
      if (!trip) throw new AppError(404, 'NOT_FOUND', 'Entidad de la recomendación no encontrada');
      if (trip.version !== rec.entity_version) return expire('El viaje cambió desde que se generó la propuesta (aprobación invalidada, ADR-0009 §5).');

      const option = input.optionKey ? rec.options.find((o) => o.key === input.optionKey) : undefined;
      if (input.decision === 'approved' && !option) throw new AppError(422, 'VALIDATION_FAILED', 'Opción inexistente en esta recomendación.');

      const nextStatus: RecommendationStatus = input.decision;
      recommendationMachine.assertTransition(rec.status, nextStatus);
      const approval = (await tx.query<{ id: string }>(
        `INSERT INTO ai.approval (tenant_id, recommendation_id, recommendation_version, option_key, decision, approver_id, approver_name, comment)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [ctx.tenant.tenantId, id, rec.version, option?.key ?? null, input.decision, ctx.actor.id, ctx.actor.name, input.comment ?? null])).rows[0]!;
      await this.events.append(tx, ctx, { eventType: input.decision === 'approved' ? 'AIApprovalGranted' : 'AIApprovalDenied', entityType: 'ai_recommendation',
        entityId: id, entityVersion: rec.version + 1, siteId: rec.site_id, payload: { option_key: option?.key ?? null, decision: input.decision, comment: input.comment ?? null } });

      let execution: Record<string, unknown> | null = null;
      if (input.decision === 'approved' && option) {
        execution = await this.execute(tx, ctx, rec, trip, option, approval.id);
        await tx.query(`UPDATE ai.recommendation SET status = 'executed', version = version + 2, decided_at = now() WHERE id = $1`, [id]);
        await this.events.append(tx, ctx, { eventType: 'AIToolExecutionRecorded', entityType: 'ai_recommendation', entityId: id, entityVersion: rec.version + 2,
          siteId: rec.site_id, payload: { option_key: option.key, result: execution } });
      } else {
        await tx.query(`UPDATE ai.recommendation SET status = $2, version = version + 1, decided_at = now() WHERE id = $1`, [id, nextStatus]);
      }
      await this.audit.record(tx, ctx, { action: `ai.recommendation.${input.decision}`, resourceType: 'ai_recommendation', resourceId: id, decision: 'allow',
        reason: input.comment ?? null, before: { status: rec.status, trip_route: trip.route_label, eta: trip.eta }, after: { option: option?.key ?? null, execution } });
      return { status: 200, body: { ok: true, status: input.decision === 'approved' ? 'executed' : nextStatus, execution } as Record<string, unknown> };
    }));
  }

  /** Ejecución del caso de uso de dominio (el mismo que usaría un coordinador). Recalcula en servidor. */
  private async execute(tx: Tx, ctx: RequestCtx, rec: RecommendationRow, trip: TripRow, option: Option, approvalId: string) {
    const idemKey = `${rec.id}:${option.key}`;
    const done = await tx.query('SELECT result FROM ai.execution_result WHERE idempotency_key = $1', [idemKey]);
    if (done.rows[0]) return done.rows[0].result as Record<string, unknown>;
    if (!['departed', 'in_transit'].includes(trip.status)) throw new AppError(409, 'INVALID_TRANSITION', 'El viaje ya no está en tránsito.');

    let result: Record<string, unknown>;
    if (option.key === 'keep_route') {
      await tx.query(`UPDATE parcel.exception_case SET status = 'acknowledged' WHERE trip_id = $1 AND status = 'open'`, [trip.id]);
      result = { action: 'keep_route', trip_code: trip.code, eta: trip.eta };
    } else {
      const alt = SCENARIOS[trip.code]?.alternatives.find((a) => a.key === option.key);
      if (!alt || !trip.eta) throw new AppError(409, 'CONFLICT', 'La alternativa ya no está disponible.');
      // Revalidación: el servidor recalcula la ETA en lugar de confiar en el valor guardado en la propuesta.
      const newEta = new Date(trip.eta.getTime() - alt.minutesSaved * 60000);
      if (Math.abs(newEta.getTime() - new Date(option.impact.etaIso).getTime()) > 60000) {
        throw new AppError(409, 'CONFLICT', 'El impacto recalculado difiere de la propuesta. Solicite una nueva evaluación.');
      }
      const newVersion = trip.route_version + 1;
      const delay = Math.max(0, Math.round((newEta.getTime() - trip.planned_arrival.getTime()) / 60000));
      const risk = evaluateTripRisk({ ...toSnapshot(trip), eta: newEta }).level;
      const elapsedMin = Math.max(0, Math.round((Date.now() - (trip.actual_departure ?? trip.planned_departure).getTime()) / 60000));
      await tx.query(
        `UPDATE tms.trip SET route_label = $2, route_version = $3, distance_km = $4, eta = $5, eta_source = 'simulator', eta_updated_at = now(),
           delay_minutes = $6, risk_level = $7, version = version + 1 WHERE id = $1`,
        [trip.id, alt.route.label, newVersion, alt.route.distanceKm, newEta, delay, risk]);
      await insertStops(tx, ctx.tenant.tenantId, trip.id, newVersion, alt.route, trip.actual_departure ?? trip.planned_departure, elapsedMin);
      await tx.query(`UPDATE parcel.shipment SET at_risk = $2, version = version + 1 WHERE trip_id = $1 AND status NOT IN ('DELIVERED','CANCELLED')`, [trip.id, risk === 'high']);
      if (risk !== 'high') await tx.query(`UPDATE parcel.exception_case SET status = 'resolved', resolved_at = now() WHERE trip_id = $1 AND kind = 'delay' AND status IN ('open','acknowledged','in_progress')`, [trip.id]);
      await this.events.append(tx, ctx, { eventType: 'RouteChanged', entityType: 'trip', entityId: trip.id, entityVersion: trip.version + 1, siteId: trip.origin_site_id,
        causationId: rec.id, payload: { from: trip.route_label, to: alt.route.label, route_version: newVersion, eta_before: trip.eta, eta_after: newEta, source: 'simulator' } });
      result = { action: option.key, trip_code: trip.code, route: alt.route.label, eta_before: trip.eta, eta_after: newEta, risk_after: risk, extra_km: alt.extraKm };
    }
    await tx.query('INSERT INTO ai.execution_result (tenant_id, approval_id, idempotency_key, status, result) VALUES ($1,$2,$3,$4,$5)',
      [ctx.tenant.tenantId, approvalId, idemKey, 'executed', JSON.stringify(result)]);
    return result;
  }
}
