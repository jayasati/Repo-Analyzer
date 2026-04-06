import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SlackService } from './slack.service';
import { EmailService } from './email.service';
import type { JobProgressEvent } from '../queue/analysis-job.types';
import { AnalysisCacheService } from '../cache/analysis-cache.service';

/**
 * Listens for analysis.progress events from the job processor.
 * When a job completes, fans out to all configured notification channels.
 */
@Injectable()
export class NotificationService {
  constructor(
    private readonly slack: SlackService,
    private readonly email: EmailService,
    private readonly cache: AnalysisCacheService,
  ) {}

  @OnEvent('analysis.progress')
  async onProgress(event: JobProgressEvent): Promise<void> {
    if (event.status !== 'complete') return;

    const result = await this.cache.get(event.jobId);
    if (!result) return;

    const payload = {
      repoUrl: result.summary?.project ?? 'unknown',
      score: result.score.overall,
      framework: result.detection.framework ?? 'unknown',
      cycles: result.cycles.length,
      smells: result.smells.length,
      jobId: event.jobId,
    };

    // Slack
    const slackUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackUrl) await this.slack.send(slackUrl, payload);

    // Discord
  }
}
