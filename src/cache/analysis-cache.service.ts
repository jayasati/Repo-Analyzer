import { Injectable, Inject } from '@nestjs/common';
import { PipelineResult } from '../core/pipeline/pipeline-result.type';
import Redis from 'ioredis';

const CACHE_PREFIX = 'analysis:result:';
const TTL_SECONDS = 3600;

@Injectable()
export class AnalysisCacheService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async set(jobId: string, result: PipelineResult): Promise<void> {
    await this.redis.set(
      `${CACHE_PREFIX}${jobId}`,
      JSON.stringify(result),
      'EX',
      TTL_SECONDS,
    );
  }

  async get(jobId: string): Promise<PipelineResult | null> {
    const raw = await this.redis.get(`${CACHE_PREFIX}${jobId}`);
    if (!raw) return null;
    return JSON.parse(raw) as PipelineResult;
  }

  async exists(jobId: string): Promise<boolean> {
    const count = await this.redis.exists(`${CACHE_PREFIX}${jobId}`);
    return count === 1;
  }
}
