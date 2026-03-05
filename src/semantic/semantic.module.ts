import { Module } from '@nestjs/common';
import { SemanticAnalyzerService } from './semantic-analyzer.service';

@Module({
  providers: [
    SemanticAnalyzerService
  ],
  exports: [
    SemanticAnalyzerService
  ]
})
export class SemanticModule {}