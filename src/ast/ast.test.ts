import { AstAnalyzerService } from './ast-analyzer.service';

const analyzer = new AstAnalyzerService();

const result = analyzer.analyze();

console.log(JSON.stringify(result.slice(0, 5), null, 2));
