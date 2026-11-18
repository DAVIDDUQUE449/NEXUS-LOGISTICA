import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { CreateUserRequest } from '@nexus/shared-contracts';
import { ROLE_BY_CODE, ROLES, PRODUCT_MODULES } from '@nexus/domain-core';
import { DbService } from '../db/db.service';
import { AuditService } from '../audit/audit.service';
import { EventService } from '../events/event.service';
import { RequirePermission, Public } from '../auth/decorators';
import { requireCtx, type AuthedRequest } from '../auth/auth-context';
import { AppError } from '../common/errors';
import { SessionService } from '../auth/session.service';
import { clampLimit, parseId } from '../common/pipes';

@Controller()
export class HealthController {
  constructor(private readonly db: DbService) {}
  @Public()
  @Get('health/live')
  live() { return { status: 'ok' }; }

  @Public()
  @Get('health/ready')
  async ready() {
    await this.db.raw((c) => c.query('SELECT 1'));
    return { status: 'ok', database: 'ok' };
  }
}

@Controller('v1')
export class CoreController {
  constructor(private readonly db: DbService, private readonly audit: AuditService, private readonly events: EventService) {}

  @RequirePermission('sites:read')
  @Get('sites')
  async sites(@Req() req: AuthedRequest) {
    const ctx = requireCtx(req);
    return this.db.withTenant(ctx.tenant, async (tx) => ({
      items: (await tx.query(
        `SELECT id, code, name, kind, city, department, lat::float, lon::float, timezone, status FROM core.site
          WHERE cardinality($1::uuid[]) = 0 OR id = ANY($1) ORDER BY name`, [ctx.subject.siteIds])).rows,
    }));
  }

  @RequirePermission('dashboard:read')
  @Get('modules')
  modules() {
    return { items: PRODUCT_MODULES };
  }

  @RequirePermission('users:read')
  @Get('roles')
  roles() {
    return { items: ROLES.filter((r) => r.code !== 'platform_superadmin').map(({ code, name, mfaRequired, interface: ui, permissions }) => ({ code, name, mfaRequired, interface: ui, permissions })) };
  }

  @RequirePermission('audit:read')
  @Get('audit/events')
  async auditEvents(@Req() req: AuthedRequest, @Query('limit') limit?: string, @Query('decision') decision?: string) {
    const ctx = requireCtx(req);
    return this.db.withTenant(ctx.tenant, async (tx) => ({
      items: (await tx.query(
        `SELECT seq::int, id, actor_kind, actor_name, action, resource_type, resource_id, decision, reason, after_redacted, correlation_id, created_at
           FROM core.audit_entry WHERE ($2::text IS NULL OR decision = $2) ORDER BY seq DESC LIMIT $1`,
        [clampLimit(limit, 100, 500), decision === 'allow' || decision === 'deny' ? decision : null])).rows,
    }));
  }

  @RequirePermission('audit:read')
  @Get('audit/verify')
  async auditVerify(@Req() req: AuthedRequest) {
    const ctx = requireCtx(req);
    return this.db.withTenant(ctx.tenant, (tx) => this.audit.verifyChain(tx, ctx.tenant.tenantId));
  }
}

@Controller('v1/users')
export class UsersController {
  constructor(private readonly db: DbService, private readonly audit: AuditService, private readonly events: EventService) {}

  @RequirePermission('users:read')
  @Get()
  async list(@Req() req: AuthedRequest) {
    const ctx = requireCtx(req);
    return this.db.withTenant(ctx.tenant, async (tx) => ({
      items: (await tx.query(
        `SELECT u.id, u.email, u.display_name, m.role_code, m.site_ids, m.status, m.created_at
           FROM core.membership m JOIN core.app_user u ON u.id = m.user_id
          ORDER BY m.status, u.display_name`)).rows.map((r) => ({ ...r, role_name: ROLE_BY_CODE.get(r.role_code)?.name ?? r.role_code })),
    }));
  }

  @RequirePermission('users:manage')
  @Post()
  async create(@Body() body: unknown, @Req() req: AuthedRequest) {
    const ctx = requireCtx(req);
    const input = CreateUserRequest.parse(body);
    const role = ROLE_BY_CODE.get(input.roleCode);
    if (!role) throw new AppError(422, 'VALIDATION_FAILED', 'Rol inexistente');
    if (role.code === 'platform_superadmin' || role.code === 'security_admin') {
      throw new AppError(403, 'FORBIDDEN', 'Ese rol solo lo asigna la plataforma (SoD-05).');
    }
    const hash = await SessionService.hashPassword(input.initialPassword);
    return this.db.withTenant(ctx.tenant, async (tx) => {
      if (input.siteIds.length) {
        const ok = await tx.query('SELECT count(*)::int AS n FROM core.site WHERE id = ANY($1)', [input.siteIds]);
        if (ok.rows[0].n !== input.siteIds.length) throw new AppError(422, 'VALIDATION_FAILED', 'Alguna sede no pertenece a la empresa');
      }
      const userId = (await tx.query('SELECT core.provision_user($1,$2,$3) AS id', [input.email, input.displayName, hash])).rows[0].id as string;
      const m = await tx.query(
        `INSERT INTO core.membership (tenant_id, user_id, role_code, site_ids, created_by) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (tenant_id, user_id, role_code) DO NOTHING RETURNING id`,
        [ctx.tenant.tenantId, userId, role.code, input.siteIds, ctx.actor.id]);
      if (!m.rows[0]) throw new AppError(409, 'CONFLICT', 'El usuario ya tiene ese rol en la empresa.');
      await this.events.append(tx, ctx, { eventType: 'MembershipGranted', entityType: 'membership', entityId: m.rows[0].id, entityVersion: 1,
        payload: { user_id: userId, role_code: role.code, site_ids: input.siteIds } });
      await this.audit.record(tx, ctx, { action: 'users.create', resourceType: 'membership', resourceId: m.rows[0].id, decision: 'allow',
        after: { email: input.email, role: role.code, site_ids: input.siteIds, password: input.initialPassword } });
      return { id: userId, membershipId: m.rows[0].id };
    });
  }

  @RequirePermission('users:manage')
  @Post(':id/deactivate')
  @HttpCode(200)
  async deactivate(@Param('id') id: string, @Req() req: AuthedRequest) {
    const ctx = requireCtx(req);
    const userId = parseId(id, 'Usuario');
    if (userId === ctx.actor.id) throw new AppError(422, 'VALIDATION_FAILED', 'No puede desactivar su propio usuario.');
    return this.db.withTenant(ctx.tenant, async (tx) => {
      const r = await tx.query(`UPDATE core.membership SET status = 'revoked' WHERE user_id = $1 AND status = 'active' RETURNING id, role_code`, [userId]);
      if (!r.rowCount) throw new AppError(404, 'NOT_FOUND', 'Usuario no encontrado o ya desactivado');
      const revoked = (await tx.query('SELECT core.revoke_user_sessions($1) AS n', [userId])).rows[0].n as number;
      for (const row of r.rows) {
        await this.events.append(tx, ctx, { eventType: 'MembershipRevoked', entityType: 'membership', entityId: row.id, entityVersion: 2, payload: { user_id: userId } });
      }
      await this.audit.record(tx, ctx, { action: 'users.deactivate', resourceType: 'user', resourceId: userId, decision: 'allow',
        after: { memberships_revoked: r.rowCount, sessions_revoked: revoked } });
      return { ok: true, membershipsRevoked: r.rowCount, sessionsRevoked: revoked };
    });
  }
}
