import { StructuralAnalyzerService } from '../structural/structural-analyzer.service';

import { SemanticAnalyzerService } from '../semantic/semantic-analyzer.service';
import { TreeSitterAnalyzer } from '../semantic/analyzers/tree-sitter-analyzer';

import { LanguageDetectorService } from '../detection/language-detector.service';

import { GraphMergeService } from '../graph/graph-merge.service';
import { DiagramPrepService } from './diagram-prep.service';
import { PlantUmlRendererService } from './plantuml-renderer.service';
import * as fs from 'fs-extra';
import * as path from 'path';

import { LocalScannerService } from '../input/local/local-scanner.service';

async function run() {
  const repoPath = path.resolve(process.cwd()); // current repo

  console.log('📁 Analyzing repo:', repoPath);

  //  Scan filesystem
  const localScanner = new LocalScannerService();
  const fileTree = await localScanner.scan(repoPath);

  //language detection
  const detector = new LanguageDetectorService();
  const detection = detector.detect(fileTree);

  const language = detection.languages[0]?.name;

//  Structural graph (files + imports)
  const structuralAnalyzer = new StructuralAnalyzerService();
  const structuralGraph = structuralAnalyzer.analyze(fileTree);

  // Semantic analysis
  const semanticAnalyzer = new SemanticAnalyzerService([
    new TreeSitterAnalyzer()
  ]);

  const semanticResult = language
    ? semanticAnalyzer.analyze(language, repoPath)
    : { nodes: [], edges: [] };

  const semanticNodes = semanticResult.nodes.map(n => ({
    id: n.id,
    type: n.type === "class" ? "class" : "unknown",
  }));

  const semanticEdges = semanticResult.edges;


  // Merge graphs
  const merger = new GraphMergeService();

  const unified = merger.merge(structuralGraph, {
    nodes: semanticNodes,
    edges: semanticEdges.map(e => ({
      from: e.from,
      to: e.to,
      type: "import" as const
    })),
  });
  
  // 4️⃣ Prepare diagrams
  const prep = new DiagramPrepService();
  const renderer = new PlantUmlRendererService();

  const classDiagram = prep.forClassDiagram(unified);
  const componentDiagram = prep.forComponentDiagram(unified);

  // Choose a real controller as entry point
  const entryController =
    unified.nodes.find(n => n.type === 'controller')?.id;

  const sequenceDiagram = entryController
    ? prep.forSequenceDiagram(unified, entryController)
    : null;

  // 5️⃣ Render PlantUML
  const outDir = path.join(process.cwd(), 'diagrams');
  await fs.ensureDir(outDir);

  await fs.writeFile(
    path.join(outDir, 'class-diagram.puml'),
    renderer.renderClassDiagram(classDiagram),
  );

  await fs.writeFile(
    path.join(outDir, 'component-diagram.puml'),
    renderer.renderComponentDiagram(componentDiagram),
  );

  if (sequenceDiagram) {
    await fs.writeFile(
      path.join(outDir, 'sequence-diagram.puml'),
      renderer.renderSequenceDiagram(sequenceDiagram),
    );
  }

  console.log('✅ Diagrams generated in /diagrams');
}

run().catch(err => {
  console.error('❌ Diagram generation failed');
  console.error(err);
});
