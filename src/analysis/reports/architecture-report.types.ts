import { ArchitectureScore } from "../scoring/architecture-score.types";
import { ArchitectureSmell } from "../smells/smell.types";

export interface ArchitectureReport {

  projectName: string;

  modules: string[];

  score: ArchitectureScore;

  smells: ArchitectureSmell[];

  cycles: { nodes: string[] }[];

}