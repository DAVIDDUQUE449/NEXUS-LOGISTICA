import type { Request } from 'express';
import type { Subject } from '@nexus/domain-core';
import type { TenantContext } from '../db/db.service';

export interface AuthContext {
  sessionId: string;
  userId: string;
  displayName: string;
  email: string;
  csrfHash: string;
  tenantId: string | null;
  siteId: string | null;
  dataMode: 'demo' | 'real' | null;
  tenantName: string | null;
  roleCodes: string[];
  /** null si aún no se eligió empresa */
  subject: Subject | null;
}

export type AuthedRequest = Request & { auth?: AuthContext; correlationId: string };

export interface RequestCtx {
  correlationId: string;
  actor: { id: string; kind: 'user' | 'agent' | 'system'; name: string };
  tenant: TenantContext;
  subject: Subject;
  siteId: string | null;
  dataMode: 'demo' | 'real';
  ipHash?: string;
}

export function requireCtx(req: AuthedRequest): RequestCtx {
  const a = req.auth;
  if (!a?.subject || !a.tenantId || !a.dataMode) throw new Error('requireCtx sin contexto (el guard debió impedirlo)');
  return {
    correlationId: req.correlationId,
    actor: { id: a.userId, kind: 'user', name: a.displayName },
    tenant: { tenantId: a.tenantId, userId: a.userId, clientAccountIds: a.subject.clientAccountIds },
    subject: a.subject,
    siteId: a.siteId,
    dataMode: a.dataMode,
  };
}
