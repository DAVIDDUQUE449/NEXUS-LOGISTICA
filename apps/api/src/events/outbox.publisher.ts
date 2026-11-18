import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import type { DbService } from '../db/db.service';

export interface PublishedEvent {
  event_id: string; tenant_id: string; event_type: string; entity_type: string; entity_id: string; site_id: string | null; recorded_at: string;
}

/**
 * Publicador del outbox. En los Hitos 1–2 corre dentro del proceso de la API y difunde a los clientes
 * SSE del mismo proceso; en el Hito 3 se mueve a apps/worker con Redis pub/sub (ADR-0006 §4).
 */
export class OutboxPublisher {
  readonly bus = new EventEmitter();
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly log = new Logger('Outbox');

  constructor(private readonly db: DbService, private readonly intervalMs: number) {
    this.bus.setMaxListeners(500);
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const rows = await this.db.raw(async (c) => (await c.query<PublishedEvent>('SELECT * FROM core.outbox_claim(100)')).rows);
      for (const ev of rows) this.bus.emit(`tenant:${ev.tenant_id}`, ev);
      return rows.length;
    } catch (err) {
      this.log.warn(`Fallo al publicar outbox: ${(err as Error).message}`);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
