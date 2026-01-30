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


    try{
      return body.source.startsWith('http')
      ?await this.analyzer.analyzeGitHub(body.source)
      : await this.analyzer.analyzeLocal(body.source);
    }catch(err:any){
      throw new InternalServerErrorException(
        err?.message || 'Analysis Failed',
      );
    }
    // if (body.source.startsWith('http')) {
    //   return this.analyzer.analyzeGitHub(body.source);
    // }

    // return this.analyzer.analyzeLocal(body.source);
  }
}
