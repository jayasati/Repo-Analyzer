import { LocalScannerService } from "../../input/local/local-scanner.service";
import { StructuralAnalyzerService } from "../../structural/structural-analyzer.service";
import { PackageGraphService } from "../graph/package-graph.service";
import { CycleDetectorService } from "../cycles/cycle-detector.service";
import { SmellDetectorService } from "../smells/smell-detector.service";
import { ArchitectureScoreService } from "./architecture-score.service";

const scanner = new LocalScannerService();
const structural = new StructuralAnalyzerService();
const packages = new PackageGraphService();
const cycles = new CycleDetectorService();
const smells = new SmellDetectorService();
const scoring = new ArchitectureScoreService();

const tree = scanner.scan(process.cwd());

const graph = structural.analyze(tree);

const packageEdges = packages.build(graph);

const detectedCycles = cycles.detect(packageEdges);

const detectedSmells = smells.detect(packageEdges);

const score = scoring.compute(packageEdges, detectedSmells);

console.log("===== ARCHITECTURE SCORE =====");
console.log(score);

console.log("\n===== BREAKDOWN =====");
console.log(score.breakdown);