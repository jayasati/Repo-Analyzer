export interface ConfidenceResult {
  score: number;
  factors: {
    repoSizeFactor: number;
    cyclePenalty: number;
    smellPenalty: number;
    stability: number;
  };
}
