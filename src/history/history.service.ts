import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AnalysisResultEntity } from '../persistence/entities/analysis-result.entity';
import { PipelineResult } from '../core/pipeline/pipeline-result.type';
import { buildRepoUrlVariants } from './repo-url.util';
import { RegressionDetectorService } from './regression-detector.service';
import type { RegressionAlert } from './regression-detector.service';

@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(AnalysisResultEntity)
    private readonly repo: Repository<AnalysisResultEntity>,
    private readonly regressionDetector: RegressionDetectorService,
  ) {}

  async save(
    repoUrl: string,
    result: PipelineResult,
    userId?: string,
  ): Promise<{ entity: AnalysisResultEntity; regression: RegressionAlert | null }> {
    const entity = this.repo.create({
      repoUrl,
      projectName: result.projectName,
      overallScore: result.score.overall,
      modularityScore: result.score.breakdown.modularity,
      couplingScore: result.score.breakdown.coupling,
      smellsScore: result.score.breakdown.smells,
      cycleCount: result.cycles.length,
      smellCount: result.smells.length,
      moduleCount: result.metrics.moduleCount,
      detectedFramework: result.detection.framework,
      detectedLanguage: result.detection.languages[0]?.name,
      fullResult: JSON.stringify(result),
      userId,
    });
    const saved = await this.repo.save(entity);

    // Check for regressions against the previous analysis
    const regression = await this.regressionDetector
      .checkForRegression(repoUrl, saved)
      .catch(() => null); // Never fail the save due to regression check

    return { entity: saved, regression };
  }

  async getHistory(
    repoUrl: string,
    limit = 20,
    cursor?: string,
  ): Promise<{
    items: AnalysisResultEntity[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    const variants = buildRepoUrlVariants(repoUrl);
    if (variants.length === 0) {
      return { items: [], nextCursor: null, hasMore: false };
    }

    const qb = this.repo
      .createQueryBuilder('ar')
      .select([
        'ar.id',
        'ar.repoUrl',
        'ar.projectName',
        'ar.overallScore',
        'ar.modularityScore',
        'ar.couplingScore',
        'ar.smellsScore',
        'ar.cycleCount',
        'ar.smellCount',
        'ar.moduleCount',
        'ar.detectedFramework',
        'ar.detectedLanguage',
        'ar.analyzedAt',
      ])
      .where('ar.repoUrl IN (:...variants)', { variants })
      .orderBy('ar.analyzedAt', 'DESC')
      .take(limit + 1); // fetch one extra to determine hasMore

    if (cursor) {
      // Cursor is the analyzedAt ISO timestamp of the last item seen
      qb.andWhere('ar.analyzedAt < :cursor', { cursor: new Date(cursor) });
    }

    const results = await qb.getMany();
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor =
      hasMore && items.length > 0
        ? items[items.length - 1].analyzedAt.toISOString()
        : null;

    return { items, nextCursor, hasMore };
  }

  async getById(id: string): Promise<AnalysisResultEntity | null> {
    return this.repo.findOneBy({ id });
  }
}
