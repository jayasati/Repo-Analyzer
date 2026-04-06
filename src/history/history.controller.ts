import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('history')
@Controller('history')
export class HistoryController {
  constructor(
    private readonly historyService: HistoryService,
    private readonly diffService: DiffService,
    private readonly trendService: TrendService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get analysis history for a repo URL' })
  @ApiQuery({ name: 'repoUrl', required: true })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getHistory(@Query('repoUrl') repoUrl: string, @Query('limit') limit = 20) {
    return this.historyService.getHistory(repoUrl, Number(limit));
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
}
