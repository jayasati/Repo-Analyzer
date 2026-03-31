import { Injectable } from '@nestjs/common';
import { PipelineResult } from '../core/pipeline/pipeline-result.type';

interface CacheEntry { result: PipelineResult; expiresAt: number; }

@Injectable()
export class AnalysisCacheService {
  private readonly store = new Map<string, CacheEntry>();

  set(jobId: string, result: PipelineResult): void {
    this.store.set(jobId, { result, expiresAt: Date.now() + 3_600_000 });
  }

  get(jobId: string): PipelineResult | null {
    const entry = this.store.get(jobId);
    if (!entry || Date.now() > entry.expiresAt) return null;
    return entry.result;
  }

  exists(jobId: string): boolean { return this.get(jobId) !== null; }
}