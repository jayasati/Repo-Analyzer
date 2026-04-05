
import {
  Controller, Get, NotFoundException, Param, Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RiskScorerService } from './risk-scorer.service';
import { ChurnEntry, GitChurnService }   from './git-churn.service';
import { AnalysisCacheService } from '../cache/analysis-cache.service';

@ApiTags('risk')
@Controller('risk')
export class RiskController {
  constructor(
    private readonly scorer: RiskScorerService,
    private readonly churn:  GitChurnService,
    private readonly cache:  AnalysisCacheService,
  ) {}

  /**
   * GET /risk/:jobId
   *
   * Returns the Architectural Risk Score for each module in a completed
   * analysis. Combines graph centrality + coupling + git churn.
   *
   * @param repoPath  Optional: local repo path for git churn analysis.
   *                  When omitted, churn factor is 0 (graph-only scoring).
   */
  @Get(':jobId')
  @ApiOperation({ summary: 'Get architectural risk scores for each module' })
  @ApiQuery({ name: 'repoPath', required: false })
  @ApiQuery({ name: 'sinceWeeks', required: false, type: Number })
  async getRisk(
    @Param('jobId')         jobId:      string,
    @Query('repoPath')      repoPath?:  string,
    @Query('sinceWeeks')    sinceWeeks?: string,
  ) {
    const result = await this.cache.get(jobId);
    if (!result) throw new NotFoundException(`Job ${jobId} not found`);

    // Build package edges from the unified graph
    const packageEdges = result.hotspots.length > 0
      ? this.buildEdgesFromHotspots(result)
      : [];

    // Attempt git churn if a repo path was provided
    let churnData: ChurnEntry[] = [];
    if (repoPath) {
      churnData = await this.churn.computeChurn(
        repoPath,
        sinceWeeks ? Number(sinceWeeks) : 12,
      );
    }

    const report = this.scorer.compute(packageEdges, churnData);

    return {
      jobId,
      projectName: result.projectName,
      ...report,
    };
  }

  // The pipeline result doesn't directly expose packageEdges, but hotspots
  // carry module names with fan-out — we reconstruct approximate edges
  // from smells and metrics for risk scoring.
  private buildEdgesFromHotspots(result: typeof undefined extends never ? never : any) {
    // Re-derive from smell modules + hotspot modules as a minimal edge set
    const edges: { from: string; to: string }[] = [];
    for (const smell of result.smells ?? []) {
      if (smell.module && smell.details?.tangled) {
        const [a, b] = smell.details.tangled as string[];
        edges.push({ from: a, to: b }, { from: b, to: a });
      }
    }
    return edges;
  }
}

