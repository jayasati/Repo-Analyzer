import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ANALYSIS_QUEUE, QUEUE_CONCURRENCY } from './queue.constants';
import { AnalysisJobData } from './analysis-job.types';
import { AnalyzerService } from '../core/analyzer.service';
import { AnalysisCacheService } from '../cache/analysis-cache.service';
import { AppLoggerService } from '../common/logger/app-logger.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * WHY EventEmitter2 for progress:
 * The SSE controller holds a Response stream open. The processor needs to
 * push progress to it. EventEmitter2 (in-process pub/sub) bridges them
 * without Redis pub/sub complexity at this phase.
 */
@Processor(ANALYSIS_QUEUE, { concurrency: QUEUE_CONCURRENCY })
export class AnalysisJobProcessor extends WorkerHost {
  constructor(
    private readonly analyzer:  AnalyzerService,
    private readonly cache:     AnalysisCacheService,
    private readonly logger:    AppLoggerService,
    private readonly emitter:   EventEmitter2,
  ) { super(); }

  async process(job: Job<AnalysisJobData>): Promise<void> {
    const { jobId, source, isGitHub } = job.data;

    const emit = (status: string, message: string, progress: number) => {
      this.emitter.emit('analysis.progress', { jobId, status, message, progress });
      job.updateProgress(progress).catch(() => {/* ignore */});
    };

    try {
      emit('cloning', isGitHub ? 'Cloning repository…' : 'Scanning local path…', 5);

      const result = isGitHub
        ? await this.analyzer.analyzeGitHub(source)
        : await this.analyzer.analyzeLocal(source);

      emit('complete', 'Analysis complete', 100);
      await this.cache.set(jobId, result);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      emit('failed', msg, 0);
      this.logger.error(`Job ${jobId} failed: ${msg}`, undefined, 'AnalysisJobProcessor');
      throw err; // Let BullMQ mark the job as failed
    }
  }
}