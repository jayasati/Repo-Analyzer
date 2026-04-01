import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalysisResultEntity } from '../persistence/entities/analysis-result.entity';

/**
 * Generates shields.io-compatible SVG badges.
 *
 * Usage in README.md:
 *   ![Score](https://your-domain.com/badge/github.com/owner/repo)
 */
@ApiTags('badge')
@Controller('badge')
export class BadgeController {
  constructor(
    @InjectRepository(AnalysisResultEntity)
    private readonly repo: Repository<AnalysisResultEntity>,
  ) {}

  @Get(':owner/:repo')
  @ApiOperation({ summary: 'Get SVG score badge for a repository' })
  async getBadge(
    @Param('owner') owner: string,
    @Param('repo')  repo:  string,
    @Res()          res:   Response,
  ): Promise<void> {
    const repoUrl = `https://github.com/${owner}/${repo}`;

    const latest = await this.repo.findOne({
      where: { repoUrl },
      order: { analyzedAt: 'DESC' },
      select: ['overallScore', 'analyzedAt'],
    });

    const score = latest?.overallScore ?? null;
    const color = score === null ? '9f9f9f'
      : score >= 80 ? '22c55e'
      : score >= 60 ? 'f59e0b'
      : 'ef4444';

    const label = score === null ? 'not analyzed' : `${score}/100`;

    const svg = this.generateBadgeSvg('architecture', label, color);

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(svg);
  }

  private generateBadgeSvg(leftText: string, rightText: string, rightColor: string): string {
    const leftW  = leftText.length  * 6.5 + 10;
    const rightW = rightText.length * 6.5 + 10;
    const totalW = leftW + rightW;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="20">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalW}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftW}"  height="20" fill="#555"/>
    <rect x="${leftW}" width="${rightW}" height="20" fill="#${rightColor}"/>
    <rect width="${totalW}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${leftW / 2}"           y="14" fill="#010101" fill-opacity=".3">${leftText}</text>
    <text x="${leftW / 2}"           y="13">${leftText}</text>
    <text x="${leftW + rightW / 2}"  y="14" fill="#010101" fill-opacity=".3">${rightText}</text>
    <text x="${leftW + rightW / 2}"  y="13">${rightText}</text>
  </g>
</svg>`;
  }
}