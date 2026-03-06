import { LocalScannerService } from "../../input/local/local-scanner.service";
import { StructuralAnalyzerService } from "../../structural/structural-analyzer.service";

import { PackageGraphService } from "../graph/package-graph.service";
import { CycleDetectorService } from "../cycles/cycle-detector.service";
import { ArchitectureMetricsService } from "./architecture-metrics.service";

const scanner = new LocalScannerService();
const structural = new StructuralAnalyzerService();
const packageGraph = new PackageGraphService();
const cycleDetector = new CycleDetectorService();
const metricsService = new ArchitectureMetricsService();

const tree = scanner.scan(process.cwd());

const graph = structural.analyze(tree);

const packageEdges = packageGraph.build(graph);

const cycles = cycleDetector.detect(packageEdges);

const modules = Array.from(
  new Set(packageEdges.flatMap(e => [e.from, e.to]))
);

const metrics = metricsService.compute(
  modules,
  packageEdges,
  cycles
);

console.log("===== ARCHITECTURE METRICS =====");
console.log(metrics);