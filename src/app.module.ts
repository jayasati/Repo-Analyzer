import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreModule }   from './core/core.module';
import { ApiModule }    from './api/api.module';
import { HealthModule } from './health/health.module';
import { LoggerModule } from './common/logger/logger.module';
import { QueueModule }  from './queue/queue.module';
import { APP_CONSTANTS } from './common/constants/app.constants';
import { AuthModule }         from './auth/auth.module';
import { HistoryModule }      from './history/history.module';
import { NotificationModule } from './notifications/notification.module';
import { BadgeModule }        from './badge/badge.module';
import { WebhookModule }      from './webhooks/webhook.module';
import { PersistenceModule }  from './persistence/persistence.module';
import { ReportModule }       from './report/report.module';


@Module({
  imports: [
    EventEmitterModule.forRoot({ global: true }),
    ThrottlerModule.forRoot([{
      ttl:   APP_CONSTANTS.RATE_LIMIT_TTL_SECONDS * 1000,
      limit: APP_CONSTANTS.RATE_LIMIT_MAX_REQUESTS,
    }]),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
    TypeOrmModule.forRoot({
      type:             'postgres',
      host:             process.env.DB_HOST     ?? 'localhost',
      port:             Number(process.env.DB_PORT ?? 5432),
      username:         process.env.DB_USER     ?? 'postgres',
      password:         process.env.DB_PASSWORD ?? 'JAY123456',
      database:         process.env.DB_NAME     ?? 'repo_analyzer',
      autoLoadEntities: true,
      synchronize:      true,
    }),
    LoggerModule,
    HealthModule,
    CoreModule,
    QueueModule,
    ApiModule,
    AuthModule,
    HistoryModule,
    NotificationModule,
    BadgeModule,
    WebhookModule,
    PersistenceModule,
    ReportModule,
  ],
})
export class AppModule {}