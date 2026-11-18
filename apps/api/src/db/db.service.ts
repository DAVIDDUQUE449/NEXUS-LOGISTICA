import { Pool, type PoolClient } from 'pg';

export interface TenantContext {
  tenantId: string;
  userId: string | null;
  /** Vacío = sin restricción por cliente (usuarios internos). */
  clientAccountIds: readonly string[];
}

export type Tx = PoolClient;

/**
 * Acceso a PostgreSQL como `nexus_app` (sin BYPASSRLS). Toda consulta de negocio corre dentro de
 * `withTenant`, que fija app.tenant_id con alcance de transacción (ADR-0004).
 */
export class DbService {
  readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 15, idleTimeoutMillis: 30000, application_name: 'nexus-api' });
  }

  async withTenant<T>(ctx: TenantContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `SELECT set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.client_account_ids', $3, true)`,
        [ctx.tenantId, ctx.userId ?? '', ctx.clientAccountIds.join(',')],
      );
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  /** Solo para funciones SECURITY DEFINER de autenticación y outbox (no tocan tablas de negocio). */
  async raw<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
