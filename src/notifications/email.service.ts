import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppLoggerService } from '../common/logger/app-logger.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService implements OnModuleInit {
  private transporter!: nodemailer.Transporter;

  constructor(private readonly logger: AppLoggerService) {}

  onModuleInit(): void {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendAnalysisComplete(opts: {
    to: string;
    repoUrl: string;
    score: number;
    framework: string;
    cycles: number;
    smells: number;
    jobId: string;
  }): Promise<void> {
    const scoreColor =
      opts.score >= 80 ? '#22c55e' : opts.score >= 60 ? '#f59e0b' : '#ef4444';
    const reportUrl = `${process.env.APP_URL ?? 'http://localhost:3000'}/analyze/${opts.jobId}/report?format=html`;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111">Analysis Complete</h2>
        <p style="color: #555">Repository: <strong>${opts.repoUrl}</strong></p>
        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 16px 0;">
          <div style="font-size: 48px; font-weight: 700; color: ${scoreColor}">${opts.score}</div>
          <div style="color: #555; font-size: 14px;">/ 100 overall score</div>
        </div>
        <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">Framework</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${opts.framework || 'unknown'}</strong></td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">Cycles</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${opts.cycles}</strong></td></tr>
          <tr><td style="padding: 8px;">Smells</td>
              <td style="padding: 8px;"><strong>${opts.smells}</strong></td></tr>
        </table>
        <a href="${reportUrl}" style="display:inline-block; background:#22c55e; color:#000;
           padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          View Full Report
        </a>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM ?? 'noreply@repoanalyzer.dev',
        to: opts.to,
        subject: `Analysis complete: ${opts.repoUrl.split('/').slice(-2).join('/')} — ${opts.score}/100`,
        html,
      });
      this.logger.log(`Email sent to ${opts.to}`, 'EmailService');
    } catch (err) {
      this.logger.error(
        `Email failed: ${String(err)}`,
        undefined,
        'EmailService',
      );
    }
  }
}
