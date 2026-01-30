import { DetectionResult } from '../../detection/detection-result.type';
import { DependencyGraph } from '../../graph/graph.types';

export interface AnalysisResult {
  projectName: string;
  source: 'local' | 'github';
  analysisDepth: 'structural' | 'framework';

  detection: DetectionResult;
  fileTree: unknown;

  structural: {
    graph: DependencyGraph;
    metrics: Record<string, any>;
  };

  // placeholders for next weeks
  framework?: unknown;
  diagrams?: unknown;
  score?: unknown;
  
}

//These types will be used everywhere.