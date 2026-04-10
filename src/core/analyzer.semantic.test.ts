import { AnalysisPipelineService } from './pipeline/analysis-pipeline.service';
import { LocalScannerService } from '../input/local/local-scanner.service';
import { LanguageDetectorService } from '../detection/language-detector.service';
import { StructuralAnalyzerService } from '../structural/structural-analyzer.service';
import { SemanticAnalyzerService } from '../semantic/semantic-analyzer.service';
import { TreeSitterAnalyzer } from '../semantic/analyzers/tree-sitter-analyzer';
import { PackageGraphService } from '../analysis/graph/package-graph.service';
import { CycleDetectorService } from '../analysis/cycles/cycle-detector.service';
import { SmellDetectorService } from '../analysis/smells/smell-detector.service';
import { ArchitectureMetricsService } from '../analysis/metrics/architecture-metrics.service';
import { ArchitectureScoreService } from '../analysis/scoring/architecture-score.service';
import { RepoSummaryService } from '../analysis/insights/repo-summary.service';
import { DiagramPrepService } from '../diagram/diagram-prep.service';
import { PlantUmlRendererService } from '../diagram/plantuml-renderer.service';
import { DiagramFilterService } from '../diagram/diagram-filter.service';
import { HotspotDetectorService } from '../analysis/insights/hotspot-detector.service';
import { ImpactAnalyzerService } from '../analysis/impact/impact-analyzer.service';
import { ArchitectureHealthService } from '../analysis/reports/architecture-health.service';
import { ConfidenceService } from '../analysis/confidence/confidence.service';
import { BaselineComparatorService } from '../analysis/baseline/baseline-comparator.service';
import { GraphMergeService } from '../graph/graph-merge.service';

// ── Build service groups matching the three pipeline token shapes ─────────────

const metricsService = new ArchitectureMetricsService();

const pipeline = new AnalysisPipelineService(
  // PIPELINE_SCANNERS group
  {
    scanner: new LocalScannerService(),
    detector: new LanguageDetectorService(),
    structuralAnalyzer: new StructuralAnalyzerService(),
    semanticAnalyzer: new SemanticAnalyzerService([new TreeSitterAnalyzer()]),
    packageGraph: new PackageGraphService(),
    merger: new GraphMergeService(),
  },
  // PIPELINE_ANALYZERS group
  {
    cycleDetector: new CycleDetectorService(),
    smellDetector: new SmellDetectorService(),
    metricsService,
    scoreService: new ArchitectureScoreService(metricsService),
    confidenceService: new ConfidenceService(),
    baselineComparator: new BaselineComparatorService(),
    hotspotDetector: new HotspotDetectorService(),
    impactAnalyzer: new ImpactAnalyzerService(),
    healthService: new ArchitectureHealthService(),
    summaryService: new RepoSummaryService(),
  },
  // PIPELINE_RENDERERS group
  {
    diagramPrep: new DiagramPrepService(),
    renderer: new PlantUmlRendererService(),
    diagramFilter: new DiagramFilterService(),
  },
);

// ── Run and print semantic-focused stats ─────────────────────────────────────

(async () => {
  const result = pipeline.run(process.cwd());

  console.log(
    'Semantic nodes:',
    result.unifiedGraph.nodes.filter((n) => n.source === 'semantic').length,
  );
  console.log(
    'Semantic edges:',
    result.unifiedGraph.edges.filter((e) => e.type === 'constructor-injection')
      .length,
  );
  console.log(JSON.stringify(result.unifiedGraph, null, 2));
})();
