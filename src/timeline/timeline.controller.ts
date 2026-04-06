// ── src/timeline/timeline.controller.ts ──────────────────────────────────────

import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TimelineService } from './timeline.service';

@ApiTags('timeline')
@Controller('timeline')
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  @Get(':repoOwner/:repoName')
  @ApiOperation({ summary: 'Get time-travel architecture history for a repo' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getTimeline(
    @Param('repoOwner') owner: string,
    @Param('repoName') name: string,
    @Query('limit') limit?: string,
  ) {
    const repoUrl = `https://github.com/${owner}/${name}`;
    return this.timeline.getTimeline(repoUrl, limit ? Number(limit) : 20);
  }

  @Get('compare/:fromId/:toId')
  @ApiOperation({ summary: 'Diff two architecture snapshots (PR comparison)' })
  compare(@Param('fromId') fromId: string, @Param('toId') toId: string) {
    return this.timeline.compareSnapshots(fromId, toId);
  }
}
