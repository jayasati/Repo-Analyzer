import { Injectable, Inject } from '@nestjs/common';
import type { PipelineResult } from '../core/pipeline/pipeline-result.type';
import Redis from 'ioredis';
import type { SourceTreeEntry } from '../copilot/source-tree.types';

const CACHE_PREFIX = 'analysis:result:';
const META_PREFIX = 'analysis:meta:';
const SOURCE_TREE_PREFIX = 'analysis:source-tree:';
const TTL_SECONDS = 3600;

export interface AnalysisJobMeta {
  jobId: string;
  source: string;
  isGitHub: boolean;
  requestedAt: string;
  branch?: string;
  subdir?: string;
}

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

  async setMeta(meta: AnalysisJobMeta): Promise<void> {
    await this.redis.set(
      `${META_PREFIX}${meta.jobId}`,
      JSON.stringify(meta),
      'EX',
      TTL_SECONDS,
    );
  }

  async getMeta(jobId: string): Promise<AnalysisJobMeta | null> {
    const raw = await this.redis.get(`${META_PREFIX}${jobId}`);
    if (!raw) return null;
    return JSON.parse(raw) as AnalysisJobMeta;
  }

  async exists(jobId: string): Promise<boolean> {
    const count = await this.redis.exists(`${CACHE_PREFIX}${jobId}`);
    return count === 1;
  }

  async setSourceTree(jobId: string, entries: SourceTreeEntry[]): Promise<void> {
    await this.redis.set(
      `${SOURCE_TREE_PREFIX}${jobId}`,
      JSON.stringify(entries),
      'EX',
      TTL_SECONDS,
    );
  }

  async getSourceTree(jobId: string): Promise<SourceTreeEntry[] | null> {
    const raw = await this.redis.get(`${SOURCE_TREE_PREFIX}${jobId}`);
    if (!raw) return null;
    return JSON.parse(raw) as SourceTreeEntry[];
  }
}
