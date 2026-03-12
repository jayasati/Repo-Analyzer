import { AnalysisPipelineService } from "./analysis-pipeline.service";
import { LocalScannerService } from "../../input/local/local-scanner.service";
import { LanguageDetectorService } from "../../detection/language-detector.service";
import { StructuralAnalyzerService } from "../../structural/structural-analyzer.service";
import { SemanticAnalyzerService } from "../../semantic/semantic-analyzer.service";
import { TreeSitterAnalyzer } from "../../semantic/analyzers/tree-sitter-analyzer";
import { PackageGraphService } from "../../analysis/graph/package-graph.service";
import { CycleDetectorService } from "../../analysis/cycles/cycle-detector.service";
import { SmellDetectorService } from "../../analysis/smells/smell-detector.service";
import { ArchitectureMetricsService } from "../../analysis/metrics/architecture-metrics.service";
import { ArchitectureScoreService } from "../../analysis/scoring/architecture-score.service";
import { RepoSummaryService } from "../../analysis/insights/repo-summary.service";
import { DiagramPrepService } from "../../diagram/diagram-prep.service";
import { PlantUmlRendererService } from "../../diagram/plantuml-renderer.service";
import { HotspotDetectorService } from "../../analysis/insights/hotspot-detector.service";
import { ImpactAnalyzerService } from "../../analysis/impact/impact-analyzer.service";
import { ArchitectureHealthService } from "../../analysis/reports/architecture-health.service";
import { ConfidenceService } from "../../analysis/confidence/confidence.service";
import { BaselineComparatorService } from "../../analysis/baseline/baseline-comparator.service";
import { GraphMergeService } from "../../graph/graph-merge.service";

const pipeline = new AnalysisPipelineService(
  new LocalScannerService(),
  new LanguageDetectorService(),
  new StructuralAnalyzerService(),
  new SemanticAnalyzerService([new TreeSitterAnalyzer()]),
  new PackageGraphService(),
  new CycleDetectorService(),
  new SmellDetectorService(),
  new ArchitectureMetricsService(),
  new ArchitectureScoreService(),
  new RepoSummaryService(),
  new DiagramPrepService(),
  new PlantUmlRendererService(),
  new HotspotDetectorService(),
  new ImpactAnalyzerService(),
  new ArchitectureHealthService(),
  new ConfidenceService(),
  new BaselineComparatorService(),
  new GraphMergeService(),
);

const result = pipeline.run(process.cwd());

// ── Project identity ─────────────────────────────────────────────────────────
console.log("\n===== PROJECT NAME =====");
console.log(result.projectName);

// ── Detection ────────────────────────────────────────────────────────────────
console.log("\n===== DETECTION =====");
console.log("Languages:  ", result.detection.languages);
console.log("Framework:  ", result.detection.framework ?? "none");
console.log("ORM:        ", result.detection.orm ?? "none");
console.log("Depth:      ", result.detection.analysisDepth);

// ── Summary ──────────────────────────────────────────────────────────────────
console.log("\n===== REPO SUMMARY =====");
console.log(JSON.stringify(result.summary, null, 2));

// ── Score ────────────────────────────────────────────────────────────────────
console.log("\n===== ARCHITECTURE SCORE =====");
console.log("Overall:    ", result.score.overall);
console.log("Modularity: ", result.score.breakdown.modularity);
console.log("Coupling:   ", result.score.breakdown.coupling);
console.log("Smells:     ", result.score.breakdown.smells);

// ── Metrics ──────────────────────────────────────────────────────────────────
console.log("\n===== ARCHITECTURE METRICS =====");
console.log(JSON.stringify(result.metrics, null, 2));

// ── Health ───────────────────────────────────────────────────────────────────
console.log("\n===== ARCHITECTURE HEALTH =====");
console.log("Score:      ", result.health.score);
console.log("Strengths:  ", result.health.strengths);
console.log("Weaknesses: ", result.health.weaknesses);

// ── Smells ───────────────────────────────────────────────────────────────────
console.log("\n===== ARCHITECTURE SMELLS =====");
if (result.smells.length === 0) {
  console.log("None detected");
} else {
  result.smells.forEach(s =>
    console.log(`[${s.severity.toUpperCase()}] ${s.type} — ${s.message}`)
  );
}

// ── Cycles ───────────────────────────────────────────────────────────────────
console.log("\n===== CIRCULAR DEPENDENCIES =====");
if (result.cycles.length === 0) {
  console.log("None detected");
} else {
  result.cycles.forEach(c => console.log(" →", c.nodes.join(" → ")));
}

// ── Hotspots ─────────────────────────────────────────────────────────────────
console.log("\n===== HOTSPOTS =====");
if (result.hotspots.length === 0) {
  console.log("None detected");
} else {
  result.hotspots.forEach(h =>
    console.log(`[${h.risk.toUpperCase()}] ${h.module} — fanOut: ${h.fanOut}`)
  );
}

// ── Impact ───────────────────────────────────────────────────────────────────
console.log("\n===== IMPACT ANALYSIS =====");
if (!result.impact) {
  console.log("No hotspot target found");
} else {
  console.log("Target:   ", result.impact.target);
  console.log("Affected: ", result.impact.affected);
}

// ── Confidence ───────────────────────────────────────────────────────────────
console.log("\n===== CONFIDENCE =====");
console.log("Score:      ", result.confidence.score);
console.log("Factors:    ", result.confidence.factors);

// ── Baseline ─────────────────────────────────────────────────────────────────
console.log("\n===== BASELINE COMPARISON =====");
result.baseline.forEach(b =>
  console.log(`${b.name}: ${b.similarity}`)
);
console.log("Predicted style:", result.baseline[0]?.name ?? "unknown");

// ── Unified graph stats ───────────────────────────────────────────────────────
console.log("\n===== UNIFIED GRAPH =====");
console.log("Total nodes:     ", result.unifiedGraph.nodes.length);
console.log("Total edges:     ", result.unifiedGraph.edges.length);
console.log("Semantic nodes:  ", result.unifiedGraph.nodes.filter(n => n.source === "semantic").length);
console.log("Structural nodes:", result.unifiedGraph.nodes.filter(n => n.source === "structural").length);
console.log("Injection edges: ", result.unifiedGraph.edges.filter(e => e.type === "constructor-injection").length);
console.log("Import edges:    ", result.unifiedGraph.edges.filter(e => e.type === "import").length);

// ── Node type breakdown ───────────────────────────────────────────────────────
console.log("\n===== NODE TYPE BREAKDOWN =====");
const nodeTypes = result.unifiedGraph.nodes.reduce<Record<string, number>>((acc, n) => {
  acc[n.type] = (acc[n.type] ?? 0) + 1;
  return acc;
}, {});
console.log(nodeTypes);

// ── Diagrams ─────────────────────────────────────────────────────────────────
console.log("\n===== CLASS DIAGRAM =====");
console.log(result.diagrams?.classDiagram ?? "not generated");

console.log("\n===== COMPONENT DIAGRAM =====");
console.log(result.diagrams?.componentDiagram ?? "not generated");

console.log("\n===== SEQUENCE DIAGRAM =====");
console.log(result.diagrams?.sequenceDiagram ?? "not generated");