import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalysisResultEntity } from './entities/analysis-result.entity';
import { PipelineResult } from '../core/pipeline/pipeline-result.type';

@Injectable()
export class PersistenceService {
  constructor(
    @InjectRepository(AnalysisResultEntity)
    private readonly repo: Repository<AnalysisResultEntity>,
  ) {}

  async save(
    repoUrl: string,
    result: PipelineResult,
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
    });
    return this.repo.save(entity);
  }

  async getHistory(
    repoUrl: string,
    limit = 10,
  ): Promise<AnalysisResultEntity[]> {
    return this.repo.find({
      where: { repoUrl },
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
}
