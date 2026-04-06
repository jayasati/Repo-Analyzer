import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GateService } from './gate.service';
import type { EvaluateGateDto, GateResult } from './gate.types';
import { AnalysisCacheService } from '../cache/analysis-cache.service';
import { PipelineResult } from '../core/pipeline/pipeline-result.type';

@ApiTags('gate')
@Controller('gate')
export class GateController {
  constructor(
    private readonly gate: GateService,
    private readonly cache: AnalysisCacheService,
  ) {}

  /**
   * POST /gate/evaluate
   *
   * Evaluates architecture gates for a completed analysis job.
   * Optionally diffs against a baseline job for regression detection.
   *
   * Designed to be called from CI/CD pipelines:
   *   curl -X POST /gate/evaluate -d '{"jobId":"...", "baselineJobId":"..."}'
   *   exit code 0 = passed, non-zero = failed (use the `passed` field)
   */
  @Post('evaluate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Evaluate architecture gates for a completed analysis',
  })
  async evaluate(@Body() dto: EvaluateGateDto): Promise<GateResult> {
    const current = await this.cache.get(dto.jobId);
    if (!current)
      throw new NotFoundException(
        `Job ${dto.jobId} not found or not yet complete`,
      );

    let previous: PipelineResult | null = null;
    if (dto.baselineJobId) {
      previous = await this.cache.get(dto.baselineJobId);
      if (!previous)
        throw new NotFoundException(
          `Baseline job ${dto.baselineJobId} not found`,
        );
    }

    return this.gate.evaluate(
      this.toContext(current),
      previous ? this.toContext(previous) : null,
      dto.thresholds,
    );
  }

  /**
   * GET /gate/:jobId/quick
   *
   * One-shot gate evaluation using project defaults.
   * No baseline comparison — just checks the current state.
   */
  @Get(':jobId/quick')
  @ApiOperation({ summary: 'Quick gate check with default thresholds' })
  async quick(@Param('jobId') jobId: string): Promise<GateResult> {
    const result = await this.cache.get(jobId);
    if (!result)
      throw new NotFoundException(`Job ${jobId} not found or not yet complete`);
    return this.gate.evaluate(this.toContext(result), null);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private toContext(r: PipelineResult) {
    return {
      overallScore: r.score.overall,
      modularityScore: r.score.breakdown.modularity,
      couplingScore: r.score.breakdown.coupling,
      smellsScore: r.score.breakdown.smells,
      cycleCount: r.cycles.length,
      smellCount: r.smells.length,
      avgFanOut: r.metrics.averageFanOut,
      smellTypes: r.smells.map((s) => s.type),
    };
  }
}
