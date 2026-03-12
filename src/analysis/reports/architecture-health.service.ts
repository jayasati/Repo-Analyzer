import { ArchitectureScore } from "../scoring/architecture-score.types";
import { ArchitectureSmell } from "../smells/smell.types";

import { Injectable } from '@nestjs/common';

@Injectable()
export class ArchitectureHealthService {

  generate(
    score: ArchitectureScore,
    smells: ArchitectureSmell[]
  ) {

    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (score.breakdown.modularity > 70) {
      strengths.push("High modularity");
    } else {
      weaknesses.push("Low modularity");
    }

    if (score.breakdown.coupling > 70) {
      strengths.push("Low coupling");
    } else {
      weaknesses.push("High coupling between modules");
    }

    if (smells.length === 0) {
      strengths.push("No major architecture smells detected");
    } else {
      weaknesses.push(`${smells.length} architecture smells detected`);
    }

    return {
      score: score.overall,
      strengths,
      weaknesses
    };

  }

}