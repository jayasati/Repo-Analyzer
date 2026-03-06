import { LocalScannerService } from "../input/local/local-scanner.service";
import { StructuralAnalyzerService } from "../structural/structural-analyzer.service";
import { PackageGraphService } from "./package-graph.service";
import { CycleDetectorService } from "./cycle-detector.service";
import { SmellDetectorService } from "./smell-detector.service";

const scanner = new LocalScannerService();
const structural = new StructuralAnalyzerService();
const packages = new PackageGraphService();
const cycles = new CycleDetectorService();
const smells = new SmellDetectorService();

const tree = scanner.scan(process.cwd());

const graph = structural.analyze(tree);

const packageEdges = packages.build(graph);

const detectedCycles = cycles.detect(packageEdges);

const detectedSmells = smells.detect(packageEdges);

console.log("===== PACKAGE DEPENDENCIES =====");
console.log(packageEdges);

console.log("\n===== CYCLES =====");
console.log(detectedCycles);

console.log("\n===== ARCHITECTURE SMELLS =====");
console.log(detectedSmells);