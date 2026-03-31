import {
  Body, Controller, Get, HttpCode, HttpStatus,
  NotFoundException, Param, Post, Res, UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { randomUUID } from 'crypto';
import { AnalyzeRequestDto } from './dto/analyze-request.dto';
import { ANALYSIS_QUEUE } from '../queue/queue.constants';
import { AnalysisCacheService } from '../cache/analysis-cache.service';
import { AppLoggerService } from '../common/logger/app-logger.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JobProgressEvent } from '../queue/analysis-job.types';
import { Query } from '@nestjs/common';
import { ReportService } from '../report/report.service';
import type { ReportFormat }  from '../report/report.types';
import { ApiOperation } from '@nestjs/swagger';

@Controller('analyze')
@UseGuards(ThrottlerGuard)
export class AnalyzeController {
  constructor(
    @InjectQueue(ANALYSIS_QUEUE) private readonly queue: Queue,
    private readonly cache:   AnalysisCacheService,
    private readonly logger:  AppLoggerService,
    private readonly emitter: EventEmitter2,
    private readonly reports: ReportService,
  ) {}

  /**
   * Enqueue analysis and return a jobId immediately.
   * The client polls GET /analyze/:jobId or streams SSE at GET /analyze/:jobId/progress.
   *
   * WHY non-blocking: 3-minute HTTP connections don't work reliably across
   * load balancers, mobile networks, or browser timeout defaults.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async enqueue(@Body() body: AnalyzeRequestDto): Promise<{ jobId: string }> {
    const jobId = randomUUID();
    const isGitHub = body.source.startsWith('https://');

    await this.queue.add(
      'analyze',
      { jobId, source: body.source, isGitHub, requestedAt: new Date().toISOString() },
      {
        jobId,
        removeOnComplete: { count: 100 },
        removeOnFail:     { count: 50 },
        attempts:         1, // No retries for user-requested analysis
      },
    );

    this.logger.log(`Enqueued job ${jobId} for ${body.source}`, 'AnalyzeController');
    return { jobId };
  }

  /**
   * Poll for the result once complete.
   */
  @Get(':jobId')
  async getResult(@Param('jobId') jobId: string) {
    const result = await this.cache.get(jobId);
    if (!result) throw new NotFoundException(`Job ${jobId} not found or not yet complete`);
    return result;
  }

  /**
   * Server-Sent Events stream — delivers real-time progress to the browser.
   *
   * WHY SSE over WebSockets: SSE is one-way (server → client), uses plain HTTP,
   * requires no library on the client, and works through proxies without
   * upgrade negotiation. Perfect for progress reporting.
   */
  @Get(':jobId/progress')
  streamProgress(
    @Param('jobId') jobId: string,
    @Res() res: Response,
  ): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    const send = (event: JobProgressEvent) => {
      if (event.jobId !== jobId) return;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (event.status === 'complete' || event.status === 'failed') {
        res.end();
        this.emitter.off('analysis.progress', send);
      }
    };

    this.emitter.on('analysis.progress', send);

    // Clean up if the client disconnects
    res.on('close', () => {
      this.emitter.off('analysis.progress', send);
    });

    // Send an initial keepalive
    res.write(`: keepalive\n\n`);
  }

  //---Report download endpoint ----------//
  @Get(':jobId/report')
  @ApiOperation({ summary: 'Download analysis report in chosen format' })
  async downloadReport(
    @Param('jobId') jobId: string,
    @Query('format') format: ReportFormat = 'markdown',
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.cache.get(jobId);
    if (!result) throw new NotFoundException(`Job ${jobId} not found or not yet complete`);

    const content = this.reports.generate(result, format);

    const contentType = format === 'html'     ? 'text/html'
      : format === 'markdown'                  ? 'text/markdown'
      : 'application/json';

    const ext = format === 'html' ? 'html' : format === 'markdown' ? 'md' : 'json';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="report-${jobId}.${ext}"`);
    res.send(content);
  }
}