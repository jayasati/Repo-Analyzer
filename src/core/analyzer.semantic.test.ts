import { AnalysisPipelineService } from './pipeline/analysis-pipeline.service';
import { LocalScannerService } from '../input/local/local-scanner.service';
import { LanguageDetectorService } from '../detection/language-detector.service';
import { StructuralAnalyzerService } from '../structural/structural-analyzer.service';
import { SemanticAnalyzerService } from '../semantic/semantic-analyzer.service';
import { TreeSitterAnalyzer } from '../semantic/analyzers/tree-sitter-analyzer';

const pipeline = new AnalysisPipelineService(
  new LocalScannerService(),
  new LanguageDetectorService(),
  new StructuralAnalyzerService(),
  new SemanticAnalyzerService([new TreeSitterAnalyzer()]),
);

(async () => {
  const result = pipeline.run(process.cwd());
  console.log('Semantic nodes:', result.unifiedGraph.nodes.filter(n => n.source === 'semantic').length);
  console.log('Semantic edges:', result.unifiedGraph.edges.filter(e => e.type === 'constructor-injection').length);
  console.log(JSON.stringify(result.unifiedGraph, null, 2));
})();