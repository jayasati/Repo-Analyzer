import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { QueueModule } from '../queue/queue.module';
import { LoggerModule } from '../common/logger/logger.module';

@Module({
  imports: [
    EventEmitterModule.forRoot({ global: true }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
    LoggerModule,
    QueueModule,
  ],
})
export class WorkerModule {}