import { DiagramPrepService } from './diagram-prep.service';
import { PlantUmlRendererService } from './plantuml-renderer.service';
import { LocalScannerService } from '../input/local/local-scanner.service';
import { StructuralAnalyzerService } from '../structural/structural-analyzer.service';
import { SemanticAnalyzerService } from '../semantic/semantic-analyzer.service';
import { TreeSitterAnalyzer } from '../semantic/analyzers/tree-sitter-analyzer';
import { GraphMergeService } from '../graph/graph-merge.service';
import { LanguageDetectorService } from '../detection/language-detector.service';

const scanner = new LocalScannerService();
const detector = new LanguageDetectorService();
const structural = new StructuralAnalyzerService();
const semantic = new SemanticAnalyzerService([new TreeSitterAnalyzer()]);
const merger = new GraphMergeService();
const prep = new DiagramPrepService();
const renderer = new PlantUmlRendererService();

const tree = scanner.scan(process.cwd());
const detection = detector.detect(tree);
const structuralGraph = structural.analyze(tree);

const language = detection.languages[0]?.name;
const semanticRaw = language ? semantic.analyze(language, process.cwd()) : { nodes: [], edges: [] };
const semanticGraph = {
  nodes: semanticRaw.nodes,
  edges: semanticRaw.edges.map(e => ({
    from: e.from, to: e.to, type: 'constructor-injection' as const,
  })),
};

const unified = merger.merge(structuralGraph, semanticGraph);

const classDiagram    = prep.forClassDiagram(unified);
const componentDiagram = prep.forComponentDiagram(unified);
const entryController = unified.nodes.find(n => n.type === 'controller')?.id;
const sequenceDiagram = entryController
  ? prep.forSequenceDiagram(unified, entryController)
  : null;

console.log('===== CLASS DIAGRAM =====');
console.log(renderer.renderClassDiagram(classDiagram));

console.log('\n===== COMPONENT DIAGRAM =====');
console.log(renderer.renderComponentDiagram(componentDiagram));

if (sequenceDiagram) {
  console.log('\n===== SEQUENCE DIAGRAM =====');
  console.log(renderer.renderSequenceDiagram(sequenceDiagram));
}