import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AnalysisResultEntity } from '../persistence/entities/analysis-result.entity';
import { PipelineResult } from '../core/pipeline/pipeline-result.type';
import { buildRepoUrlVariants } from './repo-url.util';

@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(AnalysisResultEntity)
    private readonly repo: Repository<AnalysisResultEntity>,
  ) {}

  async save(
    repoUrl: string,
    result: PipelineResult,
    userId?: string,
  ): Promise<AnalysisResultEntity> {
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
    return this.repo.save(entity);
  }

  async getHistory(
    repoUrl: string,
    limit = 20,
  ): Promise<AnalysisResultEntity[]> {
    const variants = buildRepoUrlVariants(repoUrl);
    if (variants.length === 0) return [];
    return this.repo.find({
      where: { repoUrl: In(variants) },
      order: { analyzedAt: 'DESC' },
      take: limit,
      select: [
        'id',
        'repoUrl',
        'projectName',
        'overallScore',
        'modularityScore',
        'couplingScore',
        'smellsScore',
        'cycleCount',
        'smellCount',
        'moduleCount',
        'detectedFramework',
        'detectedLanguage',
        'analyzedAt',
      ],
    });
  }

  async getById(id: string): Promise<AnalysisResultEntity | null> {
    return this.repo.findOneBy({ id });
  }
}
