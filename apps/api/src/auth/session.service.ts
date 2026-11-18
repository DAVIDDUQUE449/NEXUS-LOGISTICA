import type { DbService } from '../db/db.service';
import { DUMMY_HASH, hashPassword, randomToken, sha256, verifyPassword } from '../common/crypto';

export interface MembershipRow { tenant_id: string; tenant_code: string; tenant_name: string; data_mode: 'demo' | 'real'; role_code: string; site_ids: string[] }
export interface ResolvedSession {
  session_id: string; user_id: string; tenant_id: string | null; site_id: string | null; csrf_hash: string;
  display_name: string; email: string; expires_at: Date;
}

export class SessionService {
  constructor(private readonly db: DbService, private readonly ttlMinutes: number) {}

  /** Verifica credenciales. Tiempo constante aproximado si el usuario no existe. */
  async verifyCredentials(email: string, password: string): Promise<{ userId: string; displayName: string } | null> {
    const row = await this.db.raw(async (c) =>
      (await c.query<{ user_id: string; password_hash: string | null; status: string; display_name: string }>('SELECT * FROM core.auth_lookup($1)', [email])).rows[0]);
    const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !ok || row.status !== 'active') return null;
    return { userId: row.user_id, displayName: row.display_name };
  }

  async create(userId: string, userAgent: string, ipHash: string): Promise<{ token: string; csrf: string; sessionId: string }> {
    const token = randomToken(32);
    const csrf = randomToken(24);
    const sessionId = await this.db.raw(async (c) =>
      (await c.query<{ session_create: string }>('SELECT core.session_create($1,$2,$3,$4,$5,$6)', [sha256(token), sha256(csrf), userId, this.ttlMinutes, userAgent, ipHash])).rows[0]!.session_create);
    return { token, csrf, sessionId };
  }

  async resolve(token: string): Promise<ResolvedSession | null> {
    return this.db.raw(async (c) => (await c.query<ResolvedSession>('SELECT * FROM core.session_resolve($1)', [sha256(token)])).rows[0] ?? null);
  }

  async memberships(userId: string): Promise<MembershipRow[]> {
    return this.db.raw(async (c) => (await c.query<MembershipRow>('SELECT * FROM core.user_memberships($1)', [userId])).rows);
  }

  async setContext(sessionId: string, tenantId: string, siteId: string | null): Promise<boolean> {
    return this.db.raw(async (c) => (await c.query<{ session_set_context: boolean }>('SELECT core.session_set_context($1,$2,$3)', [sessionId, tenantId, siteId])).rows[0]!.session_set_context);
  }

  async revoke(sessionId: string): Promise<void> {
    await this.db.raw((c) => c.query('SELECT core.session_revoke($1)', [sessionId]));
  }

  static hashPassword = hashPassword;
}
