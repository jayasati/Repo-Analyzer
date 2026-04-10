export interface SemanticNode {
  id: string;
  type: string;
  /** Relative file path where this node was found (e.g. "src/auth/auth.service.ts") */
  filePath?: string;
}

export interface SemanticEdge {
  from: string;
  to: string;
  type: string;
}

export interface SemanticResult {
  nodes: SemanticNode[];
  edges: SemanticEdge[];
}

export interface SemanticAnalyzer {
  supports(language: string): boolean;

  analyze(projectPath: string): SemanticResult;
}
