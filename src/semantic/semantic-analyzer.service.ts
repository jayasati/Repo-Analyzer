import { Injectable } from '@nestjs/common';
import { SemanticAnalyzer, SemanticResult } from './interfaces/semantic-analyzer.interface';

@Injectable()
export class SemanticAnalyzerService {

  constructor(private readonly analyzers: SemanticAnalyzer[]) {}

  analyze(language: string, path: string): SemanticResult {

    const analyzer = this.analyzers.find(a => a.supports(language));

    if (!analyzer) {
      return { nodes: [], edges: [] };
    }

    return analyzer.analyze(path);
  }
}

//This service automatically selects the correct analyzer.