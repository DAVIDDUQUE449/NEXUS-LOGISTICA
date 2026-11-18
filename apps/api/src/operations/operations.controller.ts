import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Req, Res, Sse, type MessageEvent } from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { DecideRecommendationRequest, SimulateDelayRequest } from '@nexus/shared-contracts';
import { authorize } from '@nexus/domain-core';
import { DbService } from '../db/db.service';
import { RequirePermission } from '../auth/decorators';
import { requireCtx, type AuthedRequest } from '../auth/auth-context';
import { AppError } from '../common/errors';
import { clampLimit, parseId } from '../common/pipes';
import { DashboardService } from '../control-tower/dashboard.service';
import { RecommendationService } from '../ai/recommendation.service';
import { SimulatorService } from '../simulator/simulator.service';
import { OutboxPublisher, type PublishedEvent } from '../events/outbox.publisher';

@Controller('v1')
export class OperationsController {
  constructor(private readonly db: DbService, private readonly dashboard: DashboardService) {}

  @RequirePermission('dashboard:read')
  @Get('dashboard/summary')
  summary(@Req() req: AuthedRequest) {
    return this.dashboard.summary(requireCtx(req));
  }

  @RequirePermission('shipments:read')
  @Get('shipments')
  async shipments(@Req() req: AuthedRequest, @Query('limit') limit?: string) {
    const ctx = requireCtx(req);
    return this.db.withTenant(ctx.tenant, async (tx) => ({
      items: (await tx.query(
        `SELECT s.id, s.code, s.waybill_number, s.service_code, s.status, s.units, s.destination_city, s.promised_by, s.delivered_at, s.at_risk,
                c.legal_name AS client_name, t.code AS trip_code
           FROM parcel.shipment s JOIN core.client_account c ON c.id = s.client_account_id LEFT JOIN tms.trip t ON t.id = s.trip_id
          WHERE cardinality($1::uuid[]) = 0 OR s.origin_site_id = ANY($1) ORDER BY s.promised_by LIMIT $2`,
        [ctx.subject.siteIds, clampLimit(limit, 100, 500)])).rows,
    }));
  }

  /** U25: un id de otro tenant (o fuera de alcance) responde 404, nunca 403. */
  @RequirePermission('shipments:read')
  @Get('shipments/:id')
  async shipment(@Param('id') id: string, @Req() req: AuthedRequest) {
    const ctx = requireCtx(req);
    const sid = parseId(id, 'Envío');
    return this.db.withTenant(ctx.tenant, async (tx) => {
      const s = (await tx.query('SELECT * FROM parcel.shipment WHERE id = $1', [sid])).rows[0];
      if (!s || !authorize(ctx.subject, 'shipments:read', { siteId: s.origin_site_id, clientAccountId: s.client_account_id }).allow) {
        throw new AppError(404, 'NOT_FOUND', 'Envío no encontrado');
      }
      const events = (await tx.query(
        `SELECT event_type, occurred_at, recorded_at, payload, source FROM core.domain_event WHERE entity_type = 'shipment' AND entity_id = $1 ORDER BY entity_version`, [sid])).rows;
      return { ...s, events };
    });
  }

  @RequirePermission('trips:read')
  @Get('trips/:id')
  async trip(@Param('id') id: string, @Req() req: AuthedRequest) {
    const ctx = requireCtx(req);
    const tid = parseId(id, 'Viaje');
    return this.db.withTenant(ctx.tenant, async (tx) => {
      const t = (await tx.query('SELECT * FROM tms.trip WHERE id = $1', [tid])).rows[0];
      if (!t || !authorize(ctx.subject, 'trips:read', { siteId: t.origin_site_id }).allow) throw new AppError(404, 'NOT_FOUND', 'Viaje no encontrado');
      const stops = (await tx.query('SELECT seq, label, lat::float, lon::float, planned_at, actual_at, status, route_version FROM tms.trip_stop WHERE trip_id = $1 ORDER BY route_version, seq', [tid])).rows;
      const events = (await tx.query(`SELECT event_type, occurred_at, payload, operator_id, source FROM core.domain_event WHERE entity_type = 'trip' AND entity_id = $1 ORDER BY entity_version`, [tid])).rows;
      return { ...t, stops, events };
    });
  }
}

@Controller('v1/ai/recommendations')
export class RecommendationsController {
  constructor(private readonly recs: RecommendationService) {}

  @RequirePermission('ai_recommendations:read')
  @Get()
  list(@Req() req: AuthedRequest, @Query('status') status?: string) {
    const allowed = ['pending_approval', 'executed', 'rejected', 'expired', 'revision_requested'];
    return this.recs.list(requireCtx(req), status && allowed.includes(status) ? status : undefined);
  }

  @RequirePermission('ai_recommendations:read')
  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.recs.get(requireCtx(req), parseId(id, 'Recomendación'));
  }

  @RequirePermission('ai_recommendations:approve')
  @Post(':id/decide')
  @HttpCode(200)
  async decide(@Param('id') id: string, @Body() body: unknown, @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    const out = await this.recs.decide(requireCtx(req), parseId(id, 'Recomendación'), DecideRecommendationRequest.parse(body), key);
    res.status(out.status);
    if (out.replayed) res.setHeader('Idempotent-Replayed', 'true');
    return out.body;
  }
}

@Controller('v1/simulator')
export class SimulatorController {
  constructor(private readonly sim: SimulatorService) {}

  @RequirePermission('simulator:operate')
  @Post('delay')
  @HttpCode(200)
  delay(@Body() body: unknown, @Req() req: AuthedRequest) {
    const input = SimulateDelayRequest.parse(body ?? {});
    return this.sim.simulateDelay(requireCtx(req), input.tripCode, input.minutes);
  }

  @RequirePermission('simulator:operate')
  @Post('reset')
  @HttpCode(200)
  reset(@Req() req: AuthedRequest) {
    return this.sim.resetScenario(requireCtx(req));
  }
}

/** Tiempo real (SSE) por tenant: el servidor solo emite eventos del tenant de la sesión (S-P0-04). */
@Controller('v1')
export class StreamController {
  constructor(private readonly outbox: OutboxPublisher) {}

  @RequirePermission('dashboard:read')
  @Sse('stream')
  stream(@Req() req: AuthedRequest): Observable<MessageEvent> {
    const ctx = requireCtx(req);
    return new Observable<MessageEvent>((sub) => {
      const channel = `tenant:${ctx.tenant.tenantId}`;
      const handler = (ev: PublishedEvent) => {
        if (ctx.subject.siteIds.length && ev.site_id && !ctx.subject.siteIds.includes(ev.site_id)) return;
        sub.next({ type: 'domain-event', data: { event_type: ev.event_type, entity_type: ev.entity_type, entity_id: ev.entity_id, recorded_at: ev.recorded_at } });
      };
      this.outbox.bus.on(channel, handler);
      const ping = setInterval(() => sub.next({ type: 'ping', data: { at: new Date().toISOString() } }), 25000);
      return () => { this.outbox.bus.off(channel, handler); clearInterval(ping); };
    });
  }
}
