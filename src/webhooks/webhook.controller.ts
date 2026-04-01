import {
  Body, Controller, Headers, HttpCode,
  HttpStatus, Post, UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { ANALYSIS_QUEUE } from '../queue/queue.constants';
import { AppLoggerService } from '../common/logger/app-logger.service';

/**
 * GitHub webhook receiver.
 *
 * Setup:
 * 1. In GitHub repo Settings → Webhooks → Add webhook
 * 2. Payload URL: https://your-domain.com/webhooks/github
 * 3. Content type: application/json
 * 4. Secret: match GITHUB_WEBHOOK_SECRET env var
 * 5. Events: push (or "Let me select" → choose push + pull_request)
 */
@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(
    @InjectQueue(ANALYSIS_QUEUE) private readonly queue: Queue,
    private readonly logger: AppLoggerService,
  ) {}

  @Post('github')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Receive GitHub push webhook and trigger analysis' })
  async githubWebhook(
    @Body()    body:      Record<string, unknown>,
    @Headers('x-hub-signature-256') sig:   string,
    @Headers('x-github-event')      event: string,
  ): Promise<{ queued: boolean; jobId?: string }> {
    // Verify webhook signature
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (secret) {
      const expected = `sha256=${createHmac('sha256', secret)
        .update(JSON.stringify(body))
        .digest('hex')}`;
      try {
        if (!timingSafeEqual(Buffer.from(sig ?? ''), Buffer.from(expected))) {
          throw new UnauthorizedException('Invalid webhook signature');
        }
      } catch {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    // Only handle push events
    if (event !== 'push') return { queued: false };

    const repoUrl  = (body.repository as { html_url?: string })?.html_url;
    const branch   = ((body.ref as string) ?? '').replace('refs/heads/', '');
    const defaultB = (body.repository as { default_branch?: string })?.default_branch ?? 'main';

    // Only analyze pushes to the default branch
    if (branch !== defaultB) return { queued: false };

    if (!repoUrl) return { queued: false };

    const jobId = randomUUID();
    await this.queue.add(
      'analyze',
      { jobId, source: repoUrl, isGitHub: true, requestedAt: new Date().toISOString() },
      { jobId, attempts: 1, removeOnComplete: { count: 50 } },
    );

    this.logger.log(
      `Webhook: queued analysis for ${repoUrl} @ ${branch} (job ${jobId})`,
      'WebhookController',
    );

    return { queued: true, jobId };
  }
}