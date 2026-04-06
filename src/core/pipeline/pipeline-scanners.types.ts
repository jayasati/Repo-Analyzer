import { LocalScannerService } from '../../input/local/local-scanner.service';
import { LanguageDetectorService } from '../../detection/language-detector.service';
import { StructuralAnalyzerService } from '../../structural/structural-analyzer.service';
import { SemanticAnalyzerService } from '../../semantic/semantic-analyzer.service';
import { PackageGraphService } from '../../analysis/graph/package-graph.service';
import { GraphMergeService } from '../../graph/graph-merge.service';

/**
 * Groups all scan-phase dependencies injected into AnalysisPipelineService.
 * Provided as a single token (PIPELINE_SCANNERS) to keep the constructor lean.
 * File: pipeline-scanners.types.ts
 */
export interface PipelineScanners {
  scanner: LocalScannerService;
  detector: LanguageDetectorService;
  structuralAnalyzer: StructuralAnalyzerService;
  semanticAnalyzer: SemanticAnalyzerService;
  packageGraph: PackageGraphService;
  merger: GraphMergeService;
}
