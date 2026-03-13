import { Injectable } from '@nestjs/common';
import { SemanticAnalyzer, SemanticResult } from './interfaces/semantic-analyzer.interface';

@Injectable()
export class SemanticAnalyzerService {

  constructor(private readonly analyzers: SemanticAnalyzer[]) {}

  analyze(language: string, projectPath: string): SemanticResult {
    const analyzer = this.analyzers.find(a => a.supports(language));

    if (!analyzer) {
      return { nodes: [], edges: [] };
    }

    try {
      return analyzer.analyze(projectPath);
    } catch {
      // Never let semantic analysis crash the pipeline
      return { nodes: [], edges: [] };
    }
  }
}