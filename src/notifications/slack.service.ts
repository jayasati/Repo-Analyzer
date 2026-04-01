import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../common/logger/app-logger.service';

export interface SlackMessage {
  repoUrl:   string;
  score:     number;
  framework: string;
  cycles:    number;
  smells:    number;
  jobId:     string;
}

@Injectable()
export class SlackService {
  constructor(private readonly logger: AppLoggerService) {}

  async send(webhookUrl: string, msg: SlackMessage): Promise<void> {
    const scoreEmoji = msg.score >= 80 ? ':large_green_circle:' : msg.score >= 60 ? ':large_yellow_circle:' : ':red_circle:';
    const payload = {
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `Architecture Analysis Complete` },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Repo:*\n${msg.repoUrl}` },
            { type: 'mrkdwn', text: `*Score:*\n${scoreEmoji} ${msg.score}/100` },
            { type: 'mrkdwn', text: `*Framework:*\n${msg.framework || 'unknown'}` },
            { type: 'mrkdwn', text: `*Cycles:*\n${msg.cycles}` },
            { type: 'mrkdwn', text: `*Smells:*\n${msg.smells}` },
          ],
        },
        {
          type: 'actions',
          elements: [{
            type:  'button',
            text:  { type: 'plain_text', text: 'View Full Report' },
            url:   `${process.env.APP_URL ?? 'http://localhost:3000'}/analyze/${msg.jobId}/report?format=html`,
            style: 'primary',
          }],
        },
      ],
    };

    try {
      const res = await fetch(webhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) {
        this.logger.warn(`Slack webhook returned ${res.status}`, 'SlackService');
      }
    } catch (err) {
      this.logger.error(`Slack notification failed: ${String(err)}`, undefined, 'SlackService');
    }
  }
}