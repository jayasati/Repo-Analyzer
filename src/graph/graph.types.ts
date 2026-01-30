export interface GraphNode {
  id: string;        // file path or module name
  type: 'file' | 'module';
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
