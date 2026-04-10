export type NodeType =
  | 'file'
  | 'class'
  | 'module'
  | 'service'
  | 'controller'
  | 'unknown';

export type EdgeType =
  | 'import'
  | 'constructor-injection'
  | 'module-import'
  | 'module-provider'
  | 'module-controller';

export interface GraphNode {
  id: string;
  type: NodeType;
  source: 'structural' | 'semantic';
  /** Relative file path where this node was defined (semantic nodes only) */
  filePath?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: EdgeType;
}

export interface UnifiedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

//This keeps structural analysis isolated and simple.
export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
