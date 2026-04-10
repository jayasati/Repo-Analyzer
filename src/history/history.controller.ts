import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { HistoryService } from './history.service';
import { DiffService } from './diff.service';
import { TrendService } from './trend.service';
import type { BucketSize } from './trend.service';
import { TargetService } from './target.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('history')
@Controller('history')
export class HistoryController {
  constructor(
    private readonly historyService: HistoryService,
    private readonly diffService: DiffService,
    private readonly trendService: TrendService,
    private readonly targetService: TargetService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get analysis history for a repo URL' })
  @ApiQuery({ name: 'repoUrl', required: true })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, description: 'Cursor (analyzedAt ISO) for pagination' })
  getHistory(
    @Query('repoUrl') repoUrl: string,
    @Query('limit') limit = 20,
    @Query('cursor') cursor?: string,
  ) {
    return this.historyService.getHistory(repoUrl, Number(limit), cursor);
  }

  @Get('diff')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Compare two analysis results' })
  @ApiQuery({ name: 'from', required: true, description: 'First analysis ID' })
  @ApiQuery({ name: 'to', required: true, description: 'Second analysis ID' })
  getDiff(@Query('from') from: string, @Query('to') to: string) {
    return this.diffService.compare(from, to);
  }

  @Get('trend')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get score trend over time for a repo' })
  @ApiQuery({ name: 'repoUrl', required: true })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getTrend(@Query('repoUrl') repoUrl: string, @Query('limit') limit = 30) {
    return this.trendService.getTrend(repoUrl, Number(limit));
  }

  @Get('trend/aggregated')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get time-bucketed aggregated trend data' })
  @ApiQuery({ name: 'repoUrl', required: true })
  @ApiQuery({ name: 'bucket', required: false, enum: ['daily', 'weekly', 'monthly'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get('trend/modules')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get per-module smell trends over time' })
  @ApiQuery({ name: 'repoUrl', required: true })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getModuleTrends(
    @Query('repoUrl') repoUrl: string,
    @Query('limit') limit = 20,
  ) {
    return this.trendService.getModuleTrends(repoUrl, Number(limit));
  }

  getAggregatedTrend(
    @Query('repoUrl') repoUrl: string,
    @Query('bucket') bucket = 'weekly',
    @Query('limit') limit = 100,
  ) {
    return this.trendService.getAggregatedTrend(
      repoUrl,
      bucket as BucketSize,
      Number(limit),
    );
  }

  @Get('target')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get target scores for a repo' })
  @ApiQuery({ name: 'repoUrl', required: true })
  getTarget(@Query('repoUrl') repoUrl: string) {
    return this.targetService.getTarget(repoUrl);
  }

  @Put('target')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set target scores for a repo' })
  setTarget(
    @Body()
    body: {
      repoUrl: string;
      targetScore?: number;
      targetMaxSmells?: number;
      targetMaxCycles?: number;
    },
  ) {
    return this.targetService.setTarget(body.repoUrl, body);
  }
}
