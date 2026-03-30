import { Module } from '@nestjs/common';
import { RedisModule } from '@nestjs-modules/ioredis';
import { AnalysisCacheService } from './analysis-cache.service';

@Module({
  imports: [
    RedisModule.forRoot({
      type: 'single',
      url:  process.env.REDIS_URL ?? 'redis://localhost:6379',
    }),
  ],
  providers: [AnalysisCacheService],
  exports:   [AnalysisCacheService],
})
export class CacheModule {}