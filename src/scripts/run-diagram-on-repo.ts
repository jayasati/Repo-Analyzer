import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AnalysisPipelineService } from '../core/pipeline/analysis-pipeline.service';
import { DiagramPrepService } from '../diagram/diagram-prep.service';
import { PlantUmlRendererService } from '../diagram/plantuml-renderer.service';
import * as fs from 'fs-extra';
import * as path from 'path';

async function run() {
  const repoPath = path.resolve(process.cwd());
  const app = await NestFactory.createApplicationContext(AppModule);
  const pipeline = app.get(AnalysisPipelineService);
  const result = pipeline.run(repoPath);
  const graph = result.unifiedGraph;

  const prep = new DiagramPrepService();
  const renderer = new PlantUmlRendererService();

  const classDiagram = prep.forClassDiagram(graph);
  const componentDiagram = prep.forComponentDiagram(graph);
  const entryController = graph.nodes.find((n) => n.type === 'controller')?.id;
  const sequenceDiagram = entryController
    ? prep.forSequenceDiagram(graph, entryController)
    : null;

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

  await app.close();
  console.log('✅ Diagrams generated in /diagrams');
}

run();
