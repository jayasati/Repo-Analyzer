export interface ArchitectureScore {
  overall: number;

  breakdown: {
    modularity: number;
    coupling: number;
    smells: number;
  };

  /** True when graph extraction returned no package edges — no meaningful data to score. */
  noData?: boolean;
}
