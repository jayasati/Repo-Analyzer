// AFTER: src/semantic/semantic.module.ts
import { Module } from '@nestjs/common';
import { SemanticAnalyzerService } from './semantic-analyzer.service';
import { TreeSitterAnalyzer } from './analyzers/tree-sitter-analyzer';

@Module({
  providers: [
    TreeSitterAnalyzer,
    {
      provide: SemanticAnalyzerService,
      useFactory: (analyzer: TreeSitterAnalyzer) =>
        new SemanticAnalyzerService([analyzer]),
      inject: [TreeSitterAnalyzer],
    },
  ],
  exports: [SemanticAnalyzerService],
})
export class SemanticModule {}
