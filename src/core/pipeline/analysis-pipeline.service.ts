import { Injectable } from "@nestjs/common";

import { LocalScannerService } from "../../input/local/local-scanner.service";
import { LanguageDetectorService } from "../../detection/language-detector.service";
import { StructuralAnalyzerService } from "../../structural/structural-analyzer.service";

import { SemanticAnalyzerService } from "../../semantic/semantic-analyzer.service";

import { GraphMergeService } from "../../graph/graph-merge.service";

import { CycleDetectorService } from "../../analysis/cycles/cycle-detector.service";
import { SmellDetectorService } from "../../analysis/smells/smell-detector.service";

import { ArchitectureMetricsService } from "../../analysis/metrics/architecture-metrics.service";
import { ArchitectureScoreService } from "../../analysis/scoring/architecture-score.service";


import { DiagramPrepService } from "../../diagram/diagram-prep.service";
import { PlantUmlRendererService } from "../../diagram/plantuml-renderer.service";

import { PipelineResult } from "./pipeline-result.type";
import { RepoSummaryService } from "../../analysis/insights/repo-summary.service";

import { HotspotDetectorService } from "../../analysis/insights/hotspot-detector.service";

import { ImpactAnalyzerService } from "../../analysis/impact/impact-analyzer.service";

@Injectable()
export class AnalysisPipelineService {

  constructor(
    private readonly scanner: LocalScannerService,
    private readonly detector: LanguageDetectorService,
    private readonly structuralAnalyzer: StructuralAnalyzerService,
    private readonly semanticAnalyzer: SemanticAnalyzerService,
  ) {}

  run(path: string): PipelineResult {

    // 1. Scan repository
    const fileTree = this.scanner.scan(path);

    // 2. Detect language + framework
    const detection = this.detector.detect(fileTree);

    // 3. Structural analysis
    const structuralGraph = this.structuralAnalyzer.analyze(fileTree);

    // 4. Semantic analysis
    const language = detection.languages[0]?.name;

    const semanticRaw = language
    ? this.semanticAnalyzer.analyze(language, path)
    : { nodes: [], edges: [] };

    const semantic = {
    nodes: semanticRaw.nodes,
    edges: semanticRaw.edges.map(e => ({
        from: e.from,
        to: e.to,
        type: "constructor-injection" as const
    }))
    };

    // 5. Merge graphs
    const merger = new GraphMergeService();

    const unifiedGraph = merger.merge(
      structuralGraph,
      semantic
    );

    // 6. Package edges
    const packageEdges = structuralGraph.edges;

    // 7. Cycle detection
    const cycleDetector = new CycleDetectorService();

    const cycles = cycleDetector.detect(packageEdges);

    // 8. Smell detection
    const smellDetector = new SmellDetectorService();

    const smells = smellDetector.detect(packageEdges);

    // 9. Metrics
    const metricsService = new ArchitectureMetricsService();

    const metrics = metricsService.compute(
      packageEdges,
      cycles
    );

    // 10. Score
    const scoreService = new ArchitectureScoreService();

    const score = scoreService.compute(
      packageEdges,
      smells,
      cycles
    );

    const summaryService = new RepoSummaryService();

    const summary = summaryService.generate(
    path.split(/[\\/]/).pop() || "unknown",
    detection,
    unifiedGraph,
    smells,
    cycles,
    score
    );

    // 11. Diagrams
    const diagramPrep = new DiagramPrepService();
    const renderer = new PlantUmlRendererService();

    const classGraph = diagramPrep.forClassDiagram(unifiedGraph);

    const componentGraph = diagramPrep.forComponentDiagram(unifiedGraph);

    const entryController =
      unifiedGraph.nodes.find(n => n.type === "controller")?.id;

    const sequenceGraph = entryController
      ? diagramPrep.forSequenceDiagram(unifiedGraph, entryController)
      : null;

    //hotspot
    const hotspotDetector = new HotspotDetectorService();

    const hotspots = hotspotDetector.detect(packageEdges);

    //impact analyser
    const impactAnalyzer = new ImpactAnalyzerService();

    // Example: analyze impact of the largest hotspot
    const target = hotspots[0]?.module;

    const impact = target
      ? impactAnalyzer.analyze(packageEdges, target)
      : undefined;

    return {

      projectName: path.split(/[\\/]/).pop() || "unknown",

      summary,

      detection,

      unifiedGraph,

      metrics,

      smells,

      cycles,

      hotspots,

      impact,

      score,

      diagrams: {

        classDiagram: renderer.renderClassDiagram(classGraph),

        componentDiagram: renderer.renderComponentDiagram(componentGraph),

        sequenceDiagram: sequenceGraph
          ? renderer.renderSequenceDiagram(sequenceGraph)
          : undefined
      }
    };
  }
}