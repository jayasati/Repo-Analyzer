import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { ShareService } from './share.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('report')
@Controller('report')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  /**
   * Create a shareable link for an analysis report.
   * Requires authentication (you must own the analysis).
   */
  @Post('share')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a shareable link for an analysis report' })
  async createShare(
    @Body() body: { jobId: string; expiresInDays?: number },
  ) {
    return this.shareService.createShare(body.jobId, body.expiresInDays);
  }

  /**
   * View a shared report — PUBLIC endpoint, no auth required.
   * Returns self-contained HTML.
   */
  @Get('shared/:token')
  @ApiOperation({ summary: 'View a shared report (public, no auth)' })
  async viewShared(
    @Param('token') token: string,
    @Res() res: any,
  ) {
    const report = await this.shareService.getByToken(token);
    if (!report) {
      throw new NotFoundException('Report not found or expired');
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(report.htmlContent);
  }

  /**
   * Download shared report as HTML file.
   */
  @Get('shared/:token/download')
  @ApiOperation({ summary: 'Download shared report as HTML file' })
  @ApiQuery({ name: 'format', required: false, enum: ['html'] })
  async downloadShared(
    @Param('token') token: string,
    @Res() res: any,
  ) {
    const report = await this.shareService.getByToken(token);
    if (!report) {
      throw new NotFoundException('Report not found or expired');
    }

    const filename = `report-${report.projectName}.html`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(report.htmlContent);
  }
}
