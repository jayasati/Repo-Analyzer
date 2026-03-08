export interface ConfidenceResult {
  score: number;
  factors: {
    repoSize: number;
    cyclePenalty: number;
    smellPenalty: number;
    stability: number;
  };
}