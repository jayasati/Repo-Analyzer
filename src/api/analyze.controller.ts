import {
  Body, Controller, HttpCode, HttpStatus, Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AnalyzerService } from '../core/analyzer.service';
import { AnalyzeRequestDto } from './dto/analyze-request.dto';
import { AppLoggerService } from '../common/logger/app-logger.service';
import { PipelineResult } from '../core/pipeline/pipeline-result.type';
import { APP_CONSTANTS } from '../common/constants/app.constants';
import { BadRequestException } from '@nestjs/common';

/**
 * WHY for ThrottlerGuard: a single user could trivially trigger hundreds of
 * git clone + full analysis cycles, exhausting disk and CPU. Rate limiting
 * at the controller level is the simplest first line of defence.
 */
@Controller('analyze')
@UseGuards(ThrottlerGuard)
export class AnalyzeController {
  constructor(
    private readonly analyzer: AnalyzerService,
    private readonly logger:   AppLoggerService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      ttl:   APP_CONSTANTS.RATE_LIMIT_TTL_SECONDS * 1000,
      limit: APP_CONSTANTS.RATE_LIMIT_MAX_REQUESTS,
    },
  })
  async analyze(@Body() body: AnalyzeRequestDto): Promise<PipelineResult> {
    const isGitHub = body.source.startsWith('https://');

    this.logger.log(
      `Analysis requested: ${isGitHub ? 'github' : 'local'} — ${body.source}`,
      'AnalyzeController',
    );

    // Block local paths in production
    if (!isGitHub && process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Local path analysis is not available in production');
    }

    return isGitHub
      ? this.analyzer.analyzeGitHub(body.source)
      : this.analyzer.analyzeLocal(body.source);
  }
}