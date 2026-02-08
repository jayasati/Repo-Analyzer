import { DiagramPrepService } from './diagram-prep.service';

const graph = {
  nodes: [
    { id: 'ApiModule', type: 'module', source: 'semantic' },
    { id: 'AnalyzeController', type: 'controller', source: 'semantic' },
    { id: 'AnalyzerService', type: 'service', source: 'semantic' },
    { id: 'RepoA', type: 'file', source: 'structural' },
  ],
  edges: [
    { from: 'ApiModule', to: 'AnalyzeController', type: 'module-controller' },
    { from: 'AnalyzeController', to: 'AnalyzerService', type: 'constructor-injection' },
    { from: 'AnalyzerService', to: 'RepoA', type: 'constructor-injection' },
  ],
};

const prep = new DiagramPrepService();

console.log('CLASS DIAGRAM');
console.log(
  JSON.stringify(prep.forClassDiagram(graph as any), null, 2),
);

console.log('COMPONENT DIAGRAM');
console.log(
  JSON.stringify(prep.forComponentDiagram(graph as any), null, 2),
);

console.log('SEQUENCE DIAGRAM');
console.log(
  JSON.stringify(
    prep.forSequenceDiagram(graph as any, 'AnalyzeController'),
    null,
    2,
  ),
);
