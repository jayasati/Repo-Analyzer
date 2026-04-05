// ── src/app.module.ts (UPDATED) ───────────────────────────────────────────────
//
// Add the four new feature modules to AppModule.imports[]:
//   GateModule     → Architecture Gates   (POST /gate/evaluate)
//   RiskModule     → Risk Scoring         (GET  /risk/:jobId)
//   CopilotModule  → Architecture Copilot (POST /copilot/:jobId/ask)
//   TimelineModule → Time Travel          (GET  /timeline/:owner/:name)

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreModule }         from './core/core.module';
import { ApiModule }          from './api/api.module';
import { HealthModule }       from './health/health.module';
import { LoggerModule }       from './common/logger/logger.module';
import { QueueModule }        from './queue/queue.module';
import { APP_CONSTANTS }      from './common/constants/app.constants';
import { AuthModule }         from './auth/auth.module';
import { PrismaModule }       from './prisma/prisma.module';
import { ReposModule }        from './repos/repos.module';
import { HistoryModule }      from './history/history.module';
import { NotificationModule } from './notifications/notification.module';
import { BadgeModule }        from './badge/badge.module';
import { WebhookModule }      from './webhooks/webhook.module';
import { PersistenceModule }  from './persistence/persistence.module';
import { ReportModule }       from './report/report.module';

// ── New feature modules ───────────────────────────────────────────────────────
import { GateModule }     from './gate/gate.module';
import { RiskModule }     from './risk/risk.module';
import { CopilotModule }  from './copilot/copilot.module';
import { TimelineModule } from './timeline/timeline.module';

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
      host:             process.env.DB_HOST    ,
      port:             Number(process.env.DB_PORT ?? 5432),
      username:         process.env.DB_USER     ,
      password:         process.env.DB_PASSWORD ,
      database:         process.env.DB_NAME     ?? 'repo_analyzer',
      autoLoadEntities: true,
      synchronize:      true,
    }),
    LoggerModule,
    PrismaModule,
    HealthModule,
    CoreModule,
    QueueModule,
    ApiModule,
    AuthModule,
    ReposModule,
    HistoryModule,
    NotificationModule,
    BadgeModule,
    WebhookModule,
    PersistenceModule,
    ReportModule,

    // ── New feature modules ─────────────────────────────────────────────────
    GateModule,      // Architecture Gates   → /gate
    RiskModule,      // Risk Scoring         → /risk
    CopilotModule,   // Architecture Copilot → /copilot
    TimelineModule,  // Time Travel          → /timeline
  ],
})
export class AppModule {}





// ── New API surface summary ────────────────────────────────────────────────────
//
//  ARCHITECTURE GATES
//  POST /gate/evaluate        { jobId, baselineJobId?, thresholds? }
//  GET  /gate/:jobId/quick    → instant default-threshold check
//
//  RISK SCORING
//  GET  /risk/:jobId          ?repoPath=&sinceWeeks=12
//
//  ARCHITECTURE COPILOT
//  GET  /copilot/queries      → list of predefined quick-actions
//  POST /copilot/:jobId/ask   { question: "Why is my system hard to scale?" }
//  POST /copilot/:jobId/query { type: "violations"|"cycles"|"god-modules"|... }
//  GET  /copilot/:jobId/explain → auto system overview
//
//  TIME TRAVEL
//  GET  /timeline/:owner/:name  ?limit=20
//  GET  /timeline/compare/:fromId/:toId