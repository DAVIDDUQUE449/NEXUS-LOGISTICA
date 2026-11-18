import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import { AppModule } from './app.module';
import { readConfig, type AppConfig } from './config';
import { securityAndCorrelation } from './common/http.middleware';
import { OutboxPublisher } from './events/outbox.publisher';
import { DbService } from './db/db.service';

export async function createApp(overrides: Partial<AppConfig> = {}, opts: { startOutbox?: boolean; logger?: boolean } = {}) {
  const config = readConfig(overrides);
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), {
    logger: opts.logger === false ? false : ['error', 'warn', 'log'],
    bodyParser: false,
  });
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(securityAndCorrelation);
  app.use(json({ limit: '256kb' }));
  app.use(cookieParser());
  app.enableShutdownHooks();
  const outbox = app.get(OutboxPublisher);
  if (opts.startOutbox !== false) outbox.start();
  const close = app.close.bind(app);
  app.close = async () => { outbox.stop(); await close(); await app.get(DbService).close().catch(() => undefined); };
  return { app, config };
}
