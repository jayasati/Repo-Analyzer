import { TreeSitterAnalyzer } from './analyzers/tree-sitter-analyzer';

const analyzer = new TreeSitterAnalyzer();

console.log('Supports TypeScript:', analyzer.supports('TypeScript'));
console.log('Supports Python:', analyzer.supports('Python'));
console.log('Supports Java:', analyzer.supports('Java'));

const result = analyzer.analyze(process.cwd());

console.log('SEMANTIC ANALYSIS RESULT');
console.log(`Nodes: ${result.nodes.length}`);
console.log(`Edges: ${result.edges.length}`);
console.log(JSON.stringify(result, null, 2));
