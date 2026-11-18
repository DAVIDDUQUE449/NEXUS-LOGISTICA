import { Module, type DynamicModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { APP_CONFIG, type AppConfig } from './config';
import { DbService } from './db/db.service';
import { AuditService } from './audit/audit.service';
import { EventService } from './events/event.service';
import { IdempotencyService } from './events/idempotency.service';
import { OutboxPublisher } from './events/outbox.publisher';
import { SessionService } from './auth/session.service';
import { AuthGuard } from './auth/auth.guard';
import { AuthController } from './auth/auth.controller';
import { ApiExceptionFilter } from './common/exception.filter';
import { CoreController, HealthController, UsersController } from './core/core.controller';
import { OperationsController, RecommendationsController, SimulatorController, StreamController } from './operations/operations.controller';
import { DashboardService } from './control-tower/dashboard.service';
import { RecommendationService } from './ai/recommendation.service';
import { SimulatorService } from './simulator/simulator.service';

/** Monolito modular (ADR-0001). Los servicios son clases planas para poder usarlas también desde el seed y los tests. */
@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, AuthController, CoreController, UsersController, OperationsController, RecommendationsController, SimulatorController, StreamController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: DbService, useFactory: () => new DbService(config.databaseUrl) },
        { provide: AuditService, useFactory: (db: DbService) => new AuditService(db), inject: [DbService] },
        { provide: EventService, useFactory: () => new EventService() },
        { provide: IdempotencyService, useFactory: () => new IdempotencyService() },
        { provide: OutboxPublisher, useFactory: (db: DbService) => new OutboxPublisher(db, config.outboxIntervalMs), inject: [DbService] },
        { provide: SessionService, useFactory: (db: DbService) => new SessionService(db, config.sessionTtlMinutes), inject: [DbService] },
        { provide: DashboardService, useFactory: (db: DbService) => new DashboardService(db), inject: [DbService] },
        { provide: RecommendationService, useFactory: (db: DbService, a: AuditService, e: EventService, i: IdempotencyService) => new RecommendationService(db, a, e, i),
          inject: [DbService, AuditService, EventService, IdempotencyService] },
        { provide: SimulatorService, useFactory: (db: DbService, a: AuditService, e: EventService, r: RecommendationService) => new SimulatorService(db, a, e, r),
          inject: [DbService, AuditService, EventService, RecommendationService] },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
      ],
    };
  }
}
