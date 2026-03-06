import { LocalScannerService } from "../../input/local/local-scanner.service";
import { StructuralAnalyzerService } from "../../structural/structural-analyzer.service";
import { PackageGraphService } from "../graph/package-graph.service";
import { CycleDetectorService } from "../cycles/cycle-detector.service";
import { SmellDetectorService } from "../smells/smell-detector.service";

export function runAnalysis() {

  const scanner = new LocalScannerService();
  const structural = new StructuralAnalyzerService();
  const packageGraph = new PackageGraphService();
  const cycleDetector = new CycleDetectorService();
  const smellDetector = new SmellDetectorService();

  const tree = scanner.scan(process.cwd());
  const graph = structural.analyze(tree);

  const packageEdges = packageGraph.build(graph);
  const cycles = cycleDetector.detect(packageEdges);
  const smells = smellDetector.detect(packageEdges);

  return {
    tree,
    graph,
    packageEdges,
    cycles,
    smells
  };
}