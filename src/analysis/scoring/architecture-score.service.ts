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
      modularity * 0.4 +
      coupling * 0.3 +
      smellScore * 0.3;

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

  private computeCoupling(edges: { from: string; to: string }[]) {

    const fanOut = new Map<string, number>();

    edges.forEach(e => {

      fanOut.set(
        e.from,
        (fanOut.get(e.from) ?? 0) + 1
      );

    });

    const maxFanOut = Math.max(...fanOut.values(), 0);

    const score = 100 - Math.min(maxFanOut * 8, 100);

    return Math.max(score, 0);
  }

  private computeSmellPenalty(smells: ArchitectureSmell[]) {

    let penalty = 0;

    smells.forEach(smell => {

      if (smell.severity === "high") penalty += 20;
      if (smell.severity === "medium") penalty += 10;
      if (smell.severity === "low") penalty += 5;

    });

    const score = 100 - penalty;

    return Math.max(score, 0);
  }

}