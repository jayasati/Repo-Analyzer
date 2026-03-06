import { ArchitectureSmell } from "../smells/smell.types";
import { ArchitectureScore } from "./architecture-score.types";

export class ArchitectureScoreService {

  compute(
    packageEdges: { from: string; to: string }[],
    smells: ArchitectureSmell[],
  ): ArchitectureScore {

    const modularity = this.computeModularity(packageEdges);
    const coupling = this.computeCoupling(packageEdges);
    const smellScore = this.computeSmellPenalty(smells);

    const overall =
      modularity * 0.35 +
      coupling * 0.35 +
      smellScore * 0.30;

    return {
      overall: Math.round(overall),

      breakdown: {
        modularity: Math.round(modularity),
        coupling: Math.round(coupling),
        smells: Math.round(smellScore),
      }
    };

  }

  private computeModularity(edges: { from: string; to: string }[]) {

    const modules = new Set<string>();

    edges.forEach(e => {
      modules.add(e.from);
      modules.add(e.to);
    });

    const moduleCount = modules.size;
    const dependencyCount = edges.length;

    if (moduleCount === 0) return 100;

    const ratio = dependencyCount / moduleCount;

    const score = 100 - Math.min(ratio * 10, 100);

    return Math.max(score, 0);
  }


    //new update --> This prevents one module from destroying the score unfairly.
  private computeCoupling(edges: { from: string; to: string }[]) {

    const fanOut = new Map<string, number>();

    edges.forEach(e => {
    fanOut.set(e.from, (fanOut.get(e.from) ?? 0) + 1);
    });

    const values = Array.from(fanOut.values());

    if (values.length === 0) return 100;

    const avgFanOut =
    values.reduce((a, b) => a + b, 0) / values.length;

    const score = 100 - Math.min(avgFanOut * 12, 100);

    return Math.max(score, 0);
    }

    private computeSmellPenalty(smells: ArchitectureSmell[]) {

    const penalties: Record<string, number> = {
        "circular-dependency": 25,
        "god-module": 20,
        "hub-dependency": 15,
        "dead-module": 5
    };

    let penalty = 0;

    smells.forEach(smell => {
        penalty += penalties[smell.type] ?? 10;
    });

    const score = 100 - penalty;

    return Math.max(score, 0);
    }

}