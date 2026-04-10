import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ANALYSIS_QUEUE, QUEUE_CONCURRENCY } from './queue.constants';
import { AnalysisJobData } from './analysis-job.types';
import { AnalyzerService } from '../core/analyzer.service';
import { AnalysisCacheService } from '../cache/analysis-cache.service';
import { AppLoggerService } from '../common/logger/app-logger.service';
import { HistoryService } from '../history/history.service';
import { GithubIntegrationService } from '../github/github-integration.service';
import { GateService } from '../gate/gate.service';
import type { GateContext } from '../gate/gate.types';

@Processor(ANALYSIS_QUEUE, { concurrency: QUEUE_CONCURRENCY })
export class AnalysisJobProcessor extends WorkerHost {
  constructor(
    private readonly analyzer: AnalyzerService,
    private readonly cache: AnalysisCacheService,
    private readonly logger: AppLoggerService,
    private readonly emitter: EventEmitter2,
    private readonly history: HistoryService,
    private readonly githubIntegration: GithubIntegrationService,
    private readonly gate: GateService,
  ) {
    super();
  }

  async process(job: Job<AnalysisJobData>): Promise<void> {
    const { jobId, source, isGitHub, branch, subdir, requestedAt } = job.data;

    const emit = (status: string, message: string, progress: number): void => {
      this.emitter.emit('analysis.progress', {
        jobId,
        status,
        message,
        progress,
      });
      job.updateProgress(progress).catch(() => undefined);
    };

    try {
      await this.cache.setMeta({
        jobId,
        source,
        isGitHub,
        requestedAt,
        branch,
        subdir,
      });
      emit(
        'cloning',
        isGitHub ? 'Cloning repository…' : 'Scanning local path…',
        5,
      );
      emit('analyzing', 'Running analysis pipeline…', 30);

      const analyzed = isGitHub
        ? await this.analyzer.analyzeGitHubWithSourceTree(source, { branch, subdir })
        : await this.analyzer.analyzeLocalWithSourceTree(source);
      const { result, sourceTree } = analyzed;

      await this.cache.set(jobId, result);
      await this.cache.setSourceTree(jobId, sourceTree);
      try {
        await this.history.save(source, result);
      } catch (persistErr) {
        const msg =
          persistErr instanceof Error ? persistErr.message : String(persistErr);
        this.logger.warn(
          `Job ${jobId} history save skipped: ${msg}`,
          'AnalysisJobProcessor',
        );
      }
      // ── GitHub PR integration: post comment + commit status ──────────────
      if (job.data.prNumber && job.data.prHeadSha) {
        try {
          const { owner, repo: repoName } = this.parseRepoUrl(source);
          const accessToken = process.env.GITHUB_APP_TOKEN ?? '';

          if (accessToken && owner && repoName) {
            const gateCtx: GateContext = {
              overallScore: result.score.overall,
              modularityScore: result.score.breakdown.modularity,
              couplingScore: result.score.breakdown.coupling,
              smellsScore: result.score.breakdown.smells,
              cycleCount: result.cycles.length,
              smellCount: result.smells.length,
              avgFanOut: result.metrics.averageFanOut,
              smellTypes: result.smells.map((s) => s.type),
            };

            const gateResult = this.gate.evaluate(gateCtx, null);

            await this.githubIntegration.postPRComment({
              owner,
              repo: repoName,
              prNumber: job.data.prNumber,
              accessToken,
              jobId,
              gateResult,
              repoUrl: source,
            });

            await this.githubIntegration.setCommitStatus({
              owner,
              repo: repoName,
              sha: job.data.prHeadSha,
              accessToken,
              gateResult,
            });
          }
        } catch (prErr) {
          const msg = prErr instanceof Error ? prErr.message : String(prErr);
          this.logger.warn(
            `Job ${jobId} PR integration skipped: ${msg}`,
            'AnalysisJobProcessor',
          );
        }
      }

      emit('complete', 'Analysis complete', 100);
      this.logger.log(`Job ${jobId} completed`, 'AnalysisJobProcessor');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      emit('failed', msg, 0);
      this.logger.error(
        `Job ${jobId} failed: ${msg}`,
        undefined,
        'AnalysisJobProcessor',
      );
      throw err;
    }
  }

  /** Extracts owner and repo name from a GitHub URL. */
  private parseRepoUrl(url: string): { owner: string; repo: string } {
    // Handles: https://github.com/owner/repo, https://github.com/owner/repo.git
    const match = url.match(
      /github\.com[/:]([^/]+)\/([^/.]+)/,
    );
    return {
      owner: match?.[1] ?? '',
      repo: match?.[2] ?? '',
    };
  }
}
