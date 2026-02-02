import { GraphMergeService } from './graph-merge.service';
import { SmellDewtectorService } from '../analysis/smell-detector.service';
import { GraphEdge } from './unified-graph.types';

const structural = {
  nodes: [{ id: 'fileA' }, { id: 'fileB' }],
  edges: [],
};

const semantic: {
  nodes: { id: string; type: string }[];
  edges: GraphEdge[];
} = {
  nodes: [
    { id: 'AppModule', type: 'module' },
    { id: 'ControllerA', type: 'controller' },
    { id: 'ServiceA', type: 'service' },
    { id: 'RepoA', type: 'unknown' },
  ],
  edges: [
    { from: 'AppModule', to: 'ControllerA', type: 'module-controller' },
    { from: 'ControllerA', to: 'ServiceA', type: 'constructor-injection' },
    { from: 'ServiceA', to: 'RepoA', type: 'constructor-injection' },
  ],
};


const merger = new GraphMergeService();
const unified = merger.merge(structural, semantic);

const smellDetector = new SmellDewtectorService();
const smells = smellDetector.detect(unified);

console.log(JSON.stringify({ unified, smells }, null, 2));
