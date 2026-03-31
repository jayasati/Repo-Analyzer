// src/cache/cache.module.ts
import { Module } from '@nestjs/common';
import { AnalysisCacheService } from './analysis-cache.service';
import Redis from 'ioredis';

@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => new Redis({ host: process.env.REDIS_HOST ?? 'localhost', port: 6379 }),
    },
    AnalysisCacheService,
  ],
  exports: [AnalysisCacheService],
})
export class CacheModule {}