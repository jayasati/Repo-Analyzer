import { Injectable, Inject } from '@nestjs/common';

import { FileNode } from '../../shared/types/file-node.type';
import { DetectionResult } from '../../detection/detection-result.type';
import { UnifiedGraph } from '../../graph/unified-graph.types';
import { PackageEdge } from '../../analysis/graph/package-graph.service';

import {
  PIPELINE_SCANNERS,
  PIPELINE_ANALYZERS,
  PIPELINE_RENDERERS,
} from './pipeline.tokens';
import type { PipelineScanners } from './pipeline-scanners.types';
import type { PipelineAnalyzers } from './pipeline-analyzers.types';
import type { PipelineRenderers } from './pipeline-renderers.types';
import { AnalysisPhaseResult } from './analysis-phase-result.type';
import { PipelineResult } from './pipeline-result.type';
import { SourceTreeEntry } from '../../copilot/source-tree.types';

@Injectable()
export class AnalysisPipelineService {
  constructor(
    @Inject(PIPELINE_SCANNERS) private readonly scan: PipelineScanners,
    @Inject(PIPELINE_ANALYZERS) private readonly analyze: PipelineAnalyzers,
    @Inject(PIPELINE_RENDERERS) private readonly render: PipelineRenderers,
  ) {}

  // ─── Public entry point ───────────────────────────────────────────────────

  run(path: string): PipelineResult {
    const { fileTree, detection } = this.runScanPhase(path);
    const { unifiedGraph, packageEdges } = this.runGraphPhase(
      fileTree,
      detection,
      path,
    );
    const analysis = this.runAnalysisPhase(packageEdges, detection);
    const summary = this.runSummaryPhase(
      path,
      detection,
      unifiedGraph,
      analysis,
    );
    const diagrams = this.runDiagramPhase(unifiedGraph);

    return this.assemblePipelineResult(
      path,
      summary,
      diagrams,
      unifiedGraph,
      analysis,
      detection,
    );
  }

  runWithSourceTree(path: string): {
    result: PipelineResult;
    sourceTree: SourceTreeEntry[];
  } {
    const { fileTree, detection } = this.runScanPhase(path);
    const { unifiedGraph, packageEdges } = this.runGraphPhase(
      fileTree,
      detection,
      path,
    );
    const analysis = this.runAnalysisPhase(packageEdges, detection);
    const summary = this.runSummaryPhase(
      path,
      detection,
      unifiedGraph,
      analysis,
    );
    const diagrams = this.runDiagramPhase(unifiedGraph);
    const result = this.assemblePipelineResult(
      path,
      summary,
      diagrams,
      unifiedGraph,
      analysis,
      detection,
    );
    const sourceTree = this.buildSourceTreeEntries(fileTree, path);
    return { result, sourceTree };
  }

  // ─── Phase 1: Scan ────────────────────────────────────────────────────────

  private runScanPhase(path: string): {
    fileTree: FileNode;
    detection: DetectionResult;
  } {
    const fileTree = this.scan.scanner.scan(path);
    const detection = this.scan.detector.detect(fileTree);
    return { fileTree, detection };
  }

  // ─── Phase 2: Build graphs ────────────────────────────────────────────────

  private runGraphPhase(
    fileTree: FileNode,
    detection: DetectionResult,
    path: string,
  ): { unifiedGraph: UnifiedGraph; packageEdges: PackageEdge[] } {
    const structuralGraph = this.scan.structuralAnalyzer.analyze(fileTree);

    const language = detection.languages[0]?.name;
    const semanticRaw = language
      ? this.scan.semanticAnalyzer.analyze(language, path)
      : { nodes: [], edges: [] };

    const semanticGraph = {
      nodes: semanticRaw.nodes,
      edges: semanticRaw.edges.map((e) => ({
        from: e.from,
        to: e.to,
        type: 'constructor-injection' as const,
      })),
    };

    const unifiedGraph = this.scan.merger.merge(structuralGraph, semanticGraph);
    const packageEdges = this.scan.packageGraph.build(unifiedGraph);
    console.log('STRUCTURAL EDGES:', structuralGraph.edges.length);
    console.log('SEMANTIC EDGES:', semanticGraph.edges.length);
    console.log('UNIFIED EDGES:', unifiedGraph.edges.length);
    return { unifiedGraph, packageEdges };
  }

  // ─── Phase 3: Architecture analysis ──────────────────────────────────────

  private runAnalysisPhase(
    packageEdges: PackageEdge[],
    detection: DetectionResult,
  ): AnalysisPhaseResult {
    const cycles = this.analyze.cycleDetector.detect(packageEdges);

    // Pass the detected framework so smell thresholds are calibrated correctly
    const smells = this.analyze.smellDetector.detect(
      packageEdges,
      detection.framework,
    );
    const metrics = this.analyze.metricsService.compute(packageEdges, cycles);
    const score = this.analyze.scoreService.compute(
      packageEdges,
      smells,
      cycles,
    );

    // Pass framework so stability tiers are calibrated correctly
    const confidence = this.analyze.confidenceService.compute(
      metrics,
      smells,
      cycles,
      detection.framework,
    );

    const baseline = this.analyze.baselineComparator.compare(
      metrics,
      detection.framework,
    );
    const hotspots = this.analyze.hotspotDetector.detect(packageEdges);
    const hotspotTarget = hotspots[0]?.module;
    const impact = hotspotTarget
      ? this.analyze.impactAnalyzer.analyze(packageEdges, hotspotTarget)
      : undefined;

    return {
      cycles,
      smells,
      metrics,
      score,
      confidence,
      baseline,
      hotspots,
      impact,
    };
  }

  // ─── Phase 4: Summary & health report ────────────────────────────────────

  private runSummaryPhase(
    path: string,
    detection: DetectionResult,
    unifiedGraph: UnifiedGraph,
    analysis: AnalysisPhaseResult,
  ) {
    const projectName = this.extractProjectName(path);

    const summary = this.analyze.summaryService.generate(
      projectName,
      detection,
      unifiedGraph,
      analysis.smells,
      analysis.cycles,
      analysis.score,
    );

    const health = this.analyze.healthService.generate(
      analysis.score,
      analysis.smells,
    );

    return { summary, health };
  }

  // ─── Phase 5: Diagrams ────────────────────────────────────────────────────

  private runDiagramPhase(
    unifiedGraph: UnifiedGraph,
  ): PipelineResult['diagrams'] {
    // Class & sequence diagrams use the RAW unified graph —
    // DiagramPrepService already filters for constructor-injection edges
    // and controller/service/class nodes, so pre-filtering would strip
    // semantic nodes that only exist as class names (not file paths).
    const classGraph = this.render.diagramPrep.forClassDiagram(unifiedGraph);

    const entryPoint =
      this.render.diagramPrep.resolveSequenceEntryPoint(unifiedGraph);
    const sequenceGraph = entryPoint
      ? this.render.diagramPrep.forSequenceDiagram(unifiedGraph, entryPoint)
      : null;

    // Component diagram benefits from noise filtering — it operates on
    // file-path / module-level nodes where 3rd-party and config files
    // create clutter.
    const filteredForComponent = this.render.diagramFilter.filter(
      unifiedGraph,
      { maxNodes: 30 },
    );
    const componentGraph =
      this.render.diagramPrep.forComponentDiagram(filteredForComponent);

    return {
      classDiagram: this.render.renderer.renderClassDiagram(classGraph),
      componentDiagram:
        this.render.renderer.renderComponentDiagram(componentGraph),
      sequenceDiagram: sequenceGraph
        ? this.render.renderer.renderSequenceDiagram(sequenceGraph)
        : undefined,
    };
  }

  // ─── Assembly ─────────────────────────────────────────────────────────────

  private assemblePipelineResult(
    path: string,
    reportPhase: ReturnType<typeof this.runSummaryPhase>,
    diagrams: PipelineResult['diagrams'],
    unifiedGraph: UnifiedGraph,
    analysis: AnalysisPhaseResult,
    detection: DetectionResult,
  ): PipelineResult {
    return {
      projectName: this.extractProjectName(path),
      summary: reportPhase.summary,
      health: reportPhase.health,
      confidence: analysis.confidence,
      baseline: analysis.baseline,
      detection,
      unifiedGraph,
      metrics: analysis.metrics,
      smells: analysis.smells,
      cycles: analysis.cycles,
      hotspots: analysis.hotspots,
      impact: analysis.impact,
      score: analysis.score,
      diagrams,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private extractProjectName(path: string): string {
    return path.split(/[/\\]/).pop() ?? 'unknown';
  }

  private buildSourceTreeEntries(
    fileTree: FileNode,
    rootPath: string,
  ): SourceTreeEntry[] {
    const dirs = new Set<string>();
    const files = new Set<string>();

    const normalize = (p: string) => p.replace(/\\/g, '/');
    const root = normalize(rootPath).replace(/\/+$/, '');

    const walk = (node: FileNode): void => {
      const normalizedPath = normalize(node.path);
      if (!normalizedPath.startsWith(root)) return;
      const relative = normalizedPath.slice(root.length).replace(/^\/+/, '');
      if (!relative) {
        node.children?.forEach(walk);
        return;
      }

      if (node.type === 'folder') {
        dirs.add(relative);
        node.children?.forEach(walk);
        return;
      }

      files.add(relative);
      const parts = relative.split('/').filter(Boolean);
      for (let i = 1; i < parts.length; i += 1) {
        dirs.add(parts.slice(0, i).join('/'));
      }
    };

    walk(fileTree);

    const dirEntries = Array.from(dirs)
      .sort((a, b) => {
        const aDepth = a.split('/').length;
        const bDepth = b.split('/').length;
        if (aDepth !== bDepth) return aDepth - bDepth;
        return a.localeCompare(b);
      })
      .map((path) => ({ path, type: 'dir' as const }));

    const fileEntries = Array.from(files)
      .sort((a, b) => a.localeCompare(b))
      .map((path) => ({ path, type: 'file' as const }));

    return [...dirEntries, ...fileEntries];
  }
}
