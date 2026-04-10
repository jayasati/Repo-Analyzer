import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { SharedReportEntity } from '../persistence/entities/shared-report.entity';
import { ReportService } from './report.service';
import { AnalysisCacheService } from '../cache/analysis-cache.service';

export interface ShareResult {
  shareToken: string;
  /** Full URL to the shared report (relative — frontend builds the full URL) */
  shareUrl: string;
  expiresAt?: string;
}

@Injectable()
export class ShareService {
  constructor(
    @InjectRepository(SharedReportEntity)
    private readonly repo: Repository<SharedReportEntity>,
    private readonly reportService: ReportService,
    private readonly cache: AnalysisCacheService,
  ) {}

  /**
   * Creates a shareable link for an analysis report.
   * Generates the HTML report and stores it with a unique token.
   */
  async createShare(
    jobId: string,
    expiresInDays?: number,
  ): Promise<ShareResult> {
    const result = await this.cache.get(jobId);
    if (!result) {
      throw new NotFoundException(`Analysis ${jobId} not found or expired`);
    }

    const meta = await this.cache.getMeta(jobId);

    // Generate HTML report
    const htmlContent = this.reportService.generate(result, 'html');

    // Generate unique share token
    const shareToken = randomBytes(16).toString('hex');

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const entity = this.repo.create({
      shareToken,
      jobId,
      repoUrl: meta?.source ?? '',
      projectName: result.projectName,
      htmlContent,
      expiresAt,
    });

    await this.repo.save(entity);

    return {
      shareToken,
      shareUrl: `/report/shared/${shareToken}`,
      expiresAt: expiresAt?.toISOString(),
    };
  }

  /**
   * Retrieves a shared report by token. Returns null if expired or not found.
   */
  async getByToken(token: string): Promise<SharedReportEntity | null> {
    const entity = await this.repo.findOneBy({ shareToken: token });
    if (!entity) return null;

    // Check expiration
    if (entity.expiresAt && entity.expiresAt < new Date()) {
      return null;
    }

    return entity;
  }
}
