import { CanActivate, ExecutionContext, Injectable, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { authorize, type Permission } from '@nexus/domain-core';
import { AppError, unauthenticated } from '../common/errors';
import { sha256 } from '../common/crypto';
import { APP_CONFIG, type AppConfig } from '../config';
import { NO_CONTEXT_KEY, PERMISSION_KEY, PUBLIC_KEY } from './decorators';
import type { AuthedRequest } from './auth-context';
import { SessionService } from './session.service';
import { AuditService } from '../audit/audit.service';
import { timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = (secure: boolean) => (secure ? '__Host-nexus_sid' : 'nexus_sid');
export const CSRF_COOKIE = 'nexus_csrf';
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Guard global: sesión → contexto de tenant → CSRF/Origin → RBAC+ABAC.
 * Toda denegación por permiso queda auditada (D.7).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets);
    if (!SAFE.has(req.method)) this.checkOrigin(req);
    if (isPublic) return true;

    const token = req.cookies?.[SESSION_COOKIE(this.config.secureCookies)];
    if (typeof token !== 'string' || token.length < 20) throw unauthenticated();
    const s = await this.sessions.resolve(token);
    if (!s) throw unauthenticated();

    if (!SAFE.has(req.method)) {
      const header = req.header('x-csrf-token') ?? '';
      const a = Buffer.from(sha256(header)), b = Buffer.from(s.csrf_hash);
      if (!header || a.length !== b.length || !timingSafeEqual(a, b)) throw new AppError(403, 'CSRF_FAILED', 'Token CSRF inválido. Recargue la página.');
    }

    req.auth = {
      sessionId: s.session_id, userId: s.user_id, displayName: s.display_name, email: s.email, csrfHash: s.csrf_hash,
      tenantId: s.tenant_id, siteId: s.site_id, dataMode: null, tenantName: null, roleCodes: [], subject: null,
    };
    if (s.tenant_id) {
      const ms = (await this.sessions.memberships(s.user_id)).filter((m) => m.tenant_id === s.tenant_id);
      if (ms.length) {
        const allSites = ms.some((m) => m.site_ids.length === 0);
        req.auth.dataMode = ms[0]!.data_mode;
        req.auth.tenantName = ms[0]!.tenant_name;
        req.auth.roleCodes = ms.map((m) => m.role_code);
        req.auth.subject = {
          userId: s.user_id, tenantId: s.tenant_id, roleCodes: req.auth.roleCodes, kind: 'user', clientAccountIds: [],
          siteIds: allSites ? [] : [...new Set(ms.flatMap((m) => m.site_ids))],
        };
      }
    }

    if (this.reflector.getAllAndOverride<boolean>(NO_CONTEXT_KEY, targets)) return true;
    if (!req.auth.subject) throw new AppError(409, 'CONTEXT_REQUIRED', 'Seleccione una empresa para continuar.');

    const permission = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION_KEY, targets);
    if (!permission) return true;
    const decision = authorize(req.auth.subject, permission, { siteId: req.auth.siteId });
    if (!decision.allow) {
      await this.audit.recordStandalone(
        { tenant: { tenantId: req.auth.subject.tenantId, userId: s.user_id, clientAccountIds: [] }, actor: { id: s.user_id, kind: 'user', name: s.display_name }, correlationId: req.correlationId },
        { action: `${req.method} ${req.route?.path ?? req.path}`, resourceType: 'endpoint', decision: 'deny', reason: `${decision.reason} (${permission})` },
      );
      throw new AppError(403, 'FORBIDDEN', 'Su rol no tiene permiso para esta acción.');
    }
    return true;
  }

  private checkOrigin(req: AuthedRequest): void {
    const origin = req.header('origin');
    if (origin && !this.config.allowedOrigins.includes(origin)) {
      throw new AppError(403, 'CSRF_FAILED', 'Origen no permitido.');
    }
  }
}
