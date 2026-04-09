import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
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
import type { ReportFormat } from '../report/report.types';
import { ApiOperation } from '@nestjs/swagger';
import { SourceTreeEntry } from '../copilot/source-tree.types';

@Controller('analyze')
@UseGuards(ThrottlerGuard)
export class AnalyzeController {
  constructor(
    @InjectQueue(ANALYSIS_QUEUE) private readonly queue: Queue,
    private readonly cache: AnalysisCacheService,
    private readonly logger: AppLoggerService,
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
      {
        jobId,
        source: body.source,
        isGitHub,
        requestedAt: new Date().toISOString(),
        branch: body.branch,
        subdir: body.subdir,
      },
      {
        jobId,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
        attempts: 1, // No retries for user-requested analysis
      },
    );

    this.logger.log(
      `Enqueued job ${jobId} for ${body.source}`,
      'AnalyzeController',
    );
    return { jobId };
  }

  /**
   * Poll for the result once complete.
   */
  @Get(':jobId')
  @SkipThrottle()
  async getResult(@Param('jobId') jobId: string) {
    const result = await this.cache.get(jobId);
    if (!result)
      throw new NotFoundException(`Job ${jobId} not found or not yet complete`);
    return result;
  }

  /**
   * Returns source-tree entries for chat context selection.
   * Uses cached source-tree when present; otherwise derives a best-effort tree
   * from the analyzed graph so the UI can still render selectable scope.
   */
  @Get(':jobId/source-tree')
  @SkipThrottle()
  @ApiOperation({ summary: 'Get source tree for chat context selector' })
  async getSourceTree(@Param('jobId') jobId: string) {
    const cached = await this.cache.getSourceTree(jobId);
    if (cached && cached.length > 0) {
      return {
        rootHint: 'cached',
        entries: cached,
      };
    }

    const result = await this.cache.get(jobId);
    if (!result) {
      throw new NotFoundException(`Job ${jobId} not found or not yet complete`);
    }

    const entries = this.deriveSourceTreeFromResult(result);
    return {
      rootHint: result.projectName ?? 'derived',
      entries,
    };
  }

  /**
   * Server-Sent Events stream — delivers real-time progress to the browser.
   *
   * WHY SSE over WebSockets: SSE is one-way (server → client), uses plain HTTP,
   * requires no library on the client, and works through proxies without
   * upgrade negotiation. Perfect for progress reporting.
   */
  @Get(':jobId/progress')
  @SkipThrottle()
  streamProgress(@Param('jobId') jobId: string, @Res() res: Response): void {
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
  @SkipThrottle()
  @ApiOperation({ summary: 'Download analysis report in chosen format' })
  async downloadReport(
    @Param('jobId') jobId: string,
    @Query('format') format: ReportFormat = 'markdown',
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.cache.get(jobId);
    if (!result)
      throw new NotFoundException(`Job ${jobId} not found or not yet complete`);

    const content = this.reports.generate(result, format);

    const contentType =
      format === 'html'
        ? 'text/html'
        : format === 'markdown'
          ? 'text/markdown'
          : 'application/json';

    const ext =
      format === 'html' ? 'html' : format === 'markdown' ? 'md' : 'json';

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="report-${jobId}.${ext}"`,
    );
    res.send(content);
  }

  private deriveSourceTreeFromResult(
    result: { unifiedGraph?: { nodes?: Array<{ id?: string }>; edges?: Array<{ from?: string; to?: string }> } },
  ): SourceTreeEntry[] {
    const fileSet = new Set<string>();
    const dirSet = new Set<string>();

    const normalize = (p: string): string => p.replace(/\\/g, '/').trim();
    const ignored = (p: string): boolean => {
      const x = p.toLowerCase();
      return (
        x.includes('/node_modules/') ||
        x.includes('/.git/') ||
        x.includes('/dist/') ||
        x.includes('/build/') ||
        x.includes('/coverage/') ||
        x.includes('/.next/')
      );
    };
    const isFileLike = (p: string): boolean => /\.[a-z0-9]+$/i.test(p);

    const toRelativeFile = (raw: string): string | null => {
      const p = normalize(raw);
      if (!p || ignored(p) || !isFileLike(p)) return null;

      // Prefer common source anchors for absolute paths.
      for (const marker of ['/src/', '/app/', '/packages/', '/libs/', '/lib/']) {
        const idx = p.lastIndexOf(marker);
        if (idx >= 0) return p.slice(idx + 1);
      }

      // Keep already-relative paths.
      if (!/^[a-zA-Z]:\//.test(p) && !p.startsWith('/')) return p;
      return null;
    };

    const addFile = (raw: string | undefined): void => {
      if (!raw) return;
      const rel = toRelativeFile(raw);
      if (!rel) return;
      fileSet.add(rel);
      const parts = rel.split('/').filter(Boolean);
      for (let i = 1; i < parts.length; i += 1) {
        dirSet.add(parts.slice(0, i).join('/'));
      }
    };

    for (const n of result.unifiedGraph?.nodes ?? []) addFile(n.id);
    for (const e of result.unifiedGraph?.edges ?? []) {
      addFile(e.from);
      addFile(e.to);
    }

    const dirEntries: SourceTreeEntry[] = Array.from(dirSet)
      .sort((a, b) => {
        const aDepth = a.split('/').length;
        const bDepth = b.split('/').length;
        if (aDepth !== bDepth) return aDepth - bDepth;
        return a.localeCompare(b);
      })
      .map((path) => ({ path, type: 'dir' as const }));

    const fileEntries: SourceTreeEntry[] = Array.from(fileSet)
      .sort((a, b) => a.localeCompare(b))
      .map((path) => ({ path, type: 'file' as const }));

    return [...dirEntries, ...fileEntries];
  }
}
