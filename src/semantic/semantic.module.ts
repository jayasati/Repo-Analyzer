import { Module } from '@nestjs/common';
import { SemanticAnalyzerService } from './semantic-analyzer.service';
import { TreeSitterAnalyzer } from './analyzers/tree-sitter-analyzer';
import { SemanticAnalyzer } from './interfaces/semantic-analyzer.interface';

export const SEMANTIC_ANALYZERS = 'SEMANTIC_ANALYZERS';

@Module({
  providers: [
    {
      provide: SEMANTIC_ANALYZERS,
      useFactory: (): SemanticAnalyzer[] => [new TreeSitterAnalyzer()],
    },
    {
      provide: SemanticAnalyzerService,
      useFactory: (analyzers: SemanticAnalyzer[]) =>
        new SemanticAnalyzerService(analyzers),
      inject: [SEMANTIC_ANALYZERS],
    },
  ],
  exports: [SemanticAnalyzerService],
})
export class SemanticModule {}