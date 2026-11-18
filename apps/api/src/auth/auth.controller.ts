import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ContextRequest, LoginRequest } from '@nexus/shared-contracts';
import { permissionsFor, PRODUCT_MODULES } from '@nexus/domain-core';
import { APP_CONFIG, type AppConfig } from '../config';
import { AppError } from '../common/errors';
import { RateLimiter } from '../common/http.middleware';
import { sha256 } from '../common/crypto';
import { NoTenantContext, Public } from './decorators';
import { CSRF_COOKIE, SESSION_COOKIE } from './auth.guard';
import { SessionService } from './session.service';
import type { AuthedRequest } from './auth-context';
import { AuditService } from '../audit/audit.service';
import { DbService } from '../db/db.service';

@Controller('auth')
export class AuthController {
  private readonly limiter: RateLimiter;

  constructor(
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly db: DbService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.limiter = new RateLimiter(config.loginRateLimitMax, 15 * 60 * 1000);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    const input = LoginRequest.parse(body);
    const ip = req.ip ?? 'unknown';
    if (!this.limiter.allow(`${ip}:${input.email}`)) throw new AppError(429, 'RATE_LIMITED', 'Demasiados intentos. Espere 15 minutos.');
    const user = await this.sessions.verifyCredentials(input.email, input.password);
    if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Correo o contraseña incorrectos.');
    const { token, csrf, sessionId } = await this.sessions.create(user.userId, req.header('user-agent') ?? '', sha256(ip));
    const memberships = await this.sessions.memberships(user.userId);
    // Selección automática si solo hay una empresa.
    const tenants = [...new Map(memberships.map((m) => [m.tenant_id, m])).values()];
    if (tenants.length === 1) await this.sessions.setContext(sessionId, tenants[0]!.tenant_id, null);
    this.setCookies(res, token, csrf);
    for (const t of tenants) {
      await this.audit.recordStandalone(
        { tenant: { tenantId: t.tenant_id, userId: user.userId, clientAccountIds: [] }, actor: { id: user.userId, kind: 'user', name: user.displayName }, correlationId: req.correlationId, ipHash: sha256(ip) },
        { action: 'auth.login', resourceType: 'session', resourceId: sessionId, decision: 'allow' });
    }
    return { ok: true, tenants: tenants.length };
  }

  @NoTenantContext()
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    await this.sessions.revoke(req.auth!.sessionId);
    res.clearCookie(SESSION_COOKIE(this.config.secureCookies), { path: '/' });
    res.clearCookie(CSRF_COOKIE, { path: '/' });
    return { ok: true };
  }

  @NoTenantContext()
  @Get('me')
  async me(@Req() req: AuthedRequest) {
    const a = req.auth!;
    const memberships = await this.sessions.memberships(a.userId);
    const tenants = [...new Map(memberships.map((m) => [m.tenant_id, { id: m.tenant_id, code: m.tenant_code, name: m.tenant_name, dataMode: m.data_mode }])).values()];
    let sites: { id: string; code: string; name: string; city: string }[] = [];
    if (a.subject) {
      sites = await this.db.withTenant({ tenantId: a.subject.tenantId, userId: a.userId, clientAccountIds: [] }, async (tx) =>
        (await tx.query(`SELECT id, code, name, city FROM core.site WHERE status='active' AND (cardinality($1::uuid[]) = 0 OR id = ANY($1)) ORDER BY name`,
          [a.subject!.siteIds])).rows);
    }
    return {
      user: { id: a.userId, displayName: a.displayName, email: a.email },
      tenants,
      active: a.subject ? {
        tenantId: a.tenantId, tenantName: a.tenantName, dataMode: a.dataMode, siteId: a.siteId, roles: a.roleCodes,
        permissions: [...permissionsFor(a.roleCodes)], sites,
      } : null,
      modules: PRODUCT_MODULES,
    };
  }

  @NoTenantContext()
  @Post('context')
  @HttpCode(200)
  async context(@Body() body: unknown, @Req() req: AuthedRequest) {
    const input = ContextRequest.parse(body);
    const ok = await this.sessions.setContext(req.auth!.sessionId, input.tenantId, input.siteId ?? null);
    if (!ok) throw new AppError(404, 'NOT_FOUND', 'Empresa o sede no disponible para su usuario.');
    await this.audit.recordStandalone(
      { tenant: { tenantId: input.tenantId, userId: req.auth!.userId, clientAccountIds: [] }, actor: { id: req.auth!.userId, kind: 'user', name: req.auth!.displayName }, correlationId: req.correlationId },
      { action: 'auth.context.change', resourceType: 'session', resourceId: req.auth!.sessionId, decision: 'allow', after: { siteId: input.siteId ?? null } });
    return { ok: true };
  }

  private setCookies(res: Response, token: string, csrf: string): void {
    const secure = this.config.secureCookies;
    const maxAge = this.config.sessionTtlMinutes * 60 * 1000;
    res.cookie(SESSION_COOKIE(secure), token, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge });
    // Legible por el cliente para el patrón double-submit (no da acceso por sí solo).
    res.cookie(CSRF_COOKIE, csrf, { httpOnly: false, secure, sameSite: 'strict', path: '/', maxAge });
  }
}
