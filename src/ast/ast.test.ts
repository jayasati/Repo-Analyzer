import { AstAnalyzerService } from './ast-analyzer.service';

const analyzer = new AstAnalyzerService();

const result = analyzer.analyze();

// Print only a few entries to keep output readable
console.log(JSON.stringify(result.slice(0, 3), null, 2));