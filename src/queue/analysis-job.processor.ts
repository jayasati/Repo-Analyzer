import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ANALYSIS_QUEUE, QUEUE_CONCURRENCY } from './queue.constants';
import { AnalysisJobData } from './analysis-job.types';
import { AnalyzerService } from '../core/analyzer.service';
import { AnalysisCacheService } from '../cache/analysis-cache.service';
import { AppLoggerService } from '../common/logger/app-logger.service';
import { HistoryService } from '../history/history.service';

@Processor(ANALYSIS_QUEUE, { concurrency: QUEUE_CONCURRENCY })
export class AnalysisJobProcessor extends WorkerHost {
  constructor(
    private readonly analyzer: AnalyzerService,
    private readonly cache: AnalysisCacheService,
    private readonly logger: AppLoggerService,
    private readonly emitter: EventEmitter2,
    private readonly history: HistoryService,
  ) {
    super();
  }

  async process(job: Job<AnalysisJobData>): Promise<void> {
    const { jobId, source, isGitHub } = job.data;

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
      emit(
        'cloning',
        isGitHub ? 'Cloning repository…' : 'Scanning local path…',
        5,
      );
      emit('analyzing', 'Running analysis pipeline…', 30);

      const result = isGitHub
        ? await this.analyzer.analyzeGitHub(source)
        : await this.analyzer.analyzeLocal(source);

      this.cache.set(jobId, result);
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
}
