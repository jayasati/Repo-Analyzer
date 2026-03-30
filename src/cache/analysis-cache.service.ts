import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { PipelineResult } from '../core/pipeline/pipeline-result.type';

const RESULT_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * WHY cache analysis results:
 * 1. The same public repo analysed twice in an hour returns instantly.
 * 2. The SSE controller can serve the result without re-running analysis
 *    if the user refreshes the page.
 *
 * Cache key = jobId (UUID). We intentionally do NOT use the repo URL as
 * the key — two requests for the same URL at different times may get
 * different results as the repo changes.
 */
@Injectable()
export class AnalysisCacheService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async set(jobId: string, result: PipelineResult): Promise<void> {
    await this.redis.set(
      this.key(jobId),
      JSON.stringify(result),
      'EX',
      RESULT_TTL_SECONDS,
    );
  }

  async get(jobId: string): Promise<PipelineResult | null> {
    const raw = await this.redis.get(this.key(jobId));
    if (!raw) return null;
    return JSON.parse(raw) as PipelineResult;
  }

  async exists(jobId: string): Promise<boolean> {
    return (await this.redis.exists(this.key(jobId))) === 1;
  }

  private key(jobId: string): string {
    return `analysis:result:${jobId}`;
  }
}