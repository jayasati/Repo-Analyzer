import { Controller, Post, Body, BadRequestException,InternalServerErrorException, } from '@nestjs/common';
import { AnalyzerService } from '../core/analyzer.service';

@Controller('analyze')
export class AnalyzeController {
  constructor(private readonly analyzer: AnalyzerService) {}

  @Post()
  async analyze(@Body() body: { source?: string }) {
    if (!body?.source) {
      throw new BadRequestException('source is required');
    }

  // AFTER
  try {
    return body.source.startsWith('http')
      ? await this.analyzer.analyzeGitHub(body.source)
      : await this.analyzer.analyzeLocal(body.source);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Analysis failed';
    throw new InternalServerErrorException(message);
  }

  }
}
