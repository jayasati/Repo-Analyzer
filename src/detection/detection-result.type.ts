export type AnalysisDepth = 'framework' | 'structural';

export interface DetectedLanguage {
  name: string;
  confidence: number; // 0 → 1
}

export interface DetectionResult {
  languages: DetectedLanguage[];
  framework?: 'nestjs';
  orm?: 'prisma';
  analysisDepth: AnalysisDepth;
}
//This type becomes contractual.