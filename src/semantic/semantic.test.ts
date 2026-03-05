import { TypescriptAnalyzer } from './analyzers/typescript-analyzer';

const analyzer = new TypescriptAnalyzer();

const result = analyzer.analyze(process.cwd());

console.log("SEMANTIC ANALYSIS RESULT");
console.log(JSON.stringify(result, null, 2));