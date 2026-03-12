import { RepoSummary } from "./repo-summary.types";

import { DetectionResult } from "../../detection/detection-result.type";
import { UnifiedGraph } from "../../graph/unified-graph.types";
import { ArchitectureScore } from "../scoring/architecture-score.types";
import { ArchitectureSmell } from "../smells/smell.types";

import { Injectable } from '@nestjs/common';

@Injectable()
export class RepoSummaryService {

  generate(
    project: string,
    detection: DetectionResult,
    graph: UnifiedGraph,
    smells: ArchitectureSmell[],
    cycles: { nodes: string[] }[],
    score: ArchitectureScore
  ): RepoSummary {

    const fileCount = graph.nodes.filter(
      n => n.type === "file"
    ).length;

    const dependencyCount = graph.edges.length;

    const moduleCount = new Set(
      graph.nodes
        .filter(n => n.type === "module")
        .map(n => n.id)
    ).size;

    return {

      project,

      language: detection.languages[0]?.name,

      framework: detection.framework,

      files: fileCount,

      dependencies: dependencyCount,

      modules: moduleCount,

      cycles: cycles.length,

      smells: smells.length,

      architectureScore: score.overall

    };

  }

}