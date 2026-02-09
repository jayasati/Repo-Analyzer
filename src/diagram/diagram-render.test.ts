import { DiagramPrepService } from './diagram-prep.service';
import { PlantUmlRendererService } from './plantuml-renderer.service';

const graph = {
  nodes: [
    { id: 'ApiModule', type: 'module', source: 'semantic' },
    { id: 'AnalyzeController', type: 'controller', source: 'semantic' },
    { id: 'AnalyzerService', type: 'service', source: 'semantic' },
  ],
  edges: [
    { from: 'ApiModule', to: 'AnalyzeController', type: 'module-controller' },
    { from: 'AnalyzeController', to: 'AnalyzerService', type: 'constructor-injection' },
  ],
};

const prep = new DiagramPrepService();
const renderer = new PlantUmlRendererService();

const classGraph = prep.forClassDiagram(graph as any);
const componentGraph = prep.forComponentDiagram(graph as any);
const sequenceGraph = prep.forSequenceDiagram(graph as any, 'AnalyzeController');

console.log('CLASS DIAGRAM\n');
console.log(renderer.renderClassDiagram(classGraph));

console.log('\nCOMPONENT DIAGRAM\n');
console.log(renderer.renderComponentDiagram(componentGraph));

console.log('\nSEQUENCE DIAGRAM\n');
console.log(renderer.renderSequenceDiagram(sequenceGraph));
