import { AstAnalyzerService } from './ast-analyzer.service';

const analyzer = new AstAnalyzerService();

const ast = analyzer.analyze();

const edges = analyzer.buildDependencyEdges(ast);

console.log(JSON.stringify(edges.slice(0, 10), null, 2));

