import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { AnalyzerService } from '../core/analyzer.service';

@Controller('analyze')
export class AnalyzeController {
  constructor(private readonly analyzer: AnalyzerService) {}

  @Post()
  async analyze(@Body() body: { source?: string }) {
    if (!body?.source) {
      throw new BadRequestException('source is required');
    }

    if (body.source.startsWith('http')) {
      return this.analyzer.analyzeGitHub(body.source);
    }

    return this.analyzer.analyzeLocal(body.source);
  }
}
