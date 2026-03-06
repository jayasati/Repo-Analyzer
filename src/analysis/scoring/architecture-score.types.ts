export interface ArchitectureScore {

  overall: number;

  breakdown: {
    modularity: number;
    coupling: number;
    smells: number;
  };

}