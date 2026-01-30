export interface AnalysisResult {
  projectName: string;
  analysisDepth: 'structural' | 'framework';
  languages: string[];
  fileTree: unknown;
  metrics: Record<string, any>;
}
  //These types will be used everywhere.