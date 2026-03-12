import { Injectable } from "@nestjs/common";

import { LocalScannerService } from "../../input/local/local-scanner.service";
import { LanguageDetectorService } from "../../detection/language-detector.service";
import { StructuralAnalyzerService } from "../../structural/structural-analyzer.service";
import { SemanticAnalyzerService } from "../../semantic/semantic-analyzer.service";
import { GraphMergeService } from "../../graph/graph-merge.service";
import { PackageGraphService } from "../../analysis/graph/package-graph.service";
import { CycleDetectorService } from "../../analysis/cycles/cycle-detector.service";
import { SmellDetectorService } from "../../analysis/smells/smell-detector.service";
import { ArchitectureMetricsService } from "../../analysis/metrics/architecture-metrics.service";
import { ArchitectureScoreService } from "../../analysis/scoring/architecture-score.service";
import { DiagramPrepService } from "../../diagram/diagram-prep.service";
import { PlantUmlRendererService } from "../../diagram/plantuml-renderer.service";
import { RepoSummaryService } from "../../analysis/insights/repo-summary.service";
import { HotspotDetectorService } from "../../analysis/insights/hotspot-detector.service";
import { ImpactAnalyzerService } from "../../analysis/impact/impact-analyzer.service";
import { ArchitectureHealthService } from "../../analysis/reports/architecture-health.service";
import { ConfidenceService } from "../../analysis/confidence/confidence.service";
import { BaselineComparatorService } from "../../analysis/baseline/baseline-comparator.service";
import { PipelineResult } from "./pipeline-result.type";

@Injectable()
export class AnalysisPipelineService {

  // These are pure-function services with no state — safe to instantiate once
  private readonly packageGraph = new PackageGraphService();
  private readonly cycleDetector = new CycleDetectorService();
  private readonly smellDetector = new SmellDetectorService();
  private readonly metricsService = new ArchitectureMetricsService();
  private readonly scoreService = new ArchitectureScoreService();
  private readonly summaryService = new RepoSummaryService();
  private readonly diagramPrep = new DiagramPrepService();
  private readonly renderer = new PlantUmlRendererService();
  private readonly hotspotDetector = new HotspotDetectorService();
  private readonly impactAnalyzer = new ImpactAnalyzerService();
  private readonly healthService = new ArchitectureHealthService();
  private readonly confidenceService = new ConfidenceService();
  private readonly baselineComparator = new BaselineComparatorService();
  private readonly merger = new GraphMergeService();

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

    // 3. Structural analysis (file-level graph)
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
        type: "constructor-injection" as const,
      })),
    };

    // 5. Merge structural + semantic into unified graph
    const unifiedGraph = this.merger.merge(structuralGraph, semantic);

    // 6. Build package-level edges (e.g. "core" -> "input", not full file paths)
    //    This is the correct input for all architecture analysis below
    const packageEdges = this.packageGraph.build(structuralGraph);

    // 7. Cycle detection on package edges
    const cycles = this.cycleDetector.detect(packageEdges);

    // 8. Smell detection on package edges
    const smells = this.smellDetector.detect(packageEdges);

    // 9. Architecture metrics
    const metrics = this.metricsService.compute(packageEdges, cycles);

    // 10. Architecture score
    const score = this.scoreService.compute(packageEdges, smells, cycles);

    // 11. Confidence score (how reliable is our analysis)
    const confidence = this.confidenceService.compute(metrics, smells, cycles);

    // 12. Baseline comparison (what type of project does this resemble)
    const baseline = this.baselineComparator.compare(metrics);

    // 13. Repo summary
    const summary = this.summaryService.generate(
      path.split(/[\\/]/).pop() || "unknown",
      detection,
      unifiedGraph,
      smells,
      cycles,
      score,
    );

    // 14. Diagrams
    const classGraph = this.diagramPrep.forClassDiagram(unifiedGraph);
    const componentGraph = this.diagramPrep.forComponentDiagram(unifiedGraph);
    const entryController = unifiedGraph.nodes.find(n => n.type === "controller")?.id;
    const sequenceGraph = entryController
      ? this.diagramPrep.forSequenceDiagram(unifiedGraph, entryController)
      : null;

    // 15. Hotspots
    const hotspots = this.hotspotDetector.detect(packageEdges);

    // 16. Impact analysis — target the highest-risk hotspot
    const hotspotTarget = hotspots[0]?.module;
    const impact = hotspotTarget
      ? this.impactAnalyzer.analyze(packageEdges, hotspotTarget)
      : undefined;

    // 17. Health report
    const health = this.healthService.generate(score, smells);

    return {
      projectName: path.split(/[\\/]/).pop() || "unknown",
      summary,
      health,
      confidence,
      baseline,
      detection,
      unifiedGraph,
      metrics,
      smells,
      cycles,
      hotspots,
      impact,
      score,
      diagrams: {
        classDiagram: this.renderer.renderClassDiagram(classGraph),
        componentDiagram: this.renderer.renderComponentDiagram(componentGraph),
        sequenceDiagram: sequenceGraph
          ? this.renderer.renderSequenceDiagram(sequenceGraph)
          : undefined,
      },
    };
  }
}