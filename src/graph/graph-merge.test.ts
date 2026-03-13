import { GraphMergeService } from './graph-merge.service';
import { SmellDetectorService } from '../analysis/smells/smell-detector.service';
import { PackageGraphService } from '../analysis/graph/package-graph.service';
import { GraphEdge } from './unified-graph.types';

// AFTER
const structural = {
  nodes: [
    { id: 'fileA', type: 'file' },
    { id: 'fileB', type: 'file' },
  ],
  edges: [] as GraphEdge[],
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

// SmellDetectorService expects package-level edges, not a UnifiedGraph
const packageGraph = new PackageGraphService();
const packageEdges = packageGraph.build(unified);

const smellDetector = new SmellDetectorService();
const smells = smellDetector.detect(packageEdges);

console.log(JSON.stringify({ unified, packageEdges, smells }, null, 2));