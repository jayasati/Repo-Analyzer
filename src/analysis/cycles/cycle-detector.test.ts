import { LocalScannerService } from "../../input/local/local-scanner.service";
import { StructuralAnalyzerService } from "../../structural/structural-analyzer.service";
import { PackageGraphService } from "../graph/package-graph.service";
import { CycleDetectorService } from "./cycle-detector.service";

const scanner = new LocalScannerService();
const structural = new StructuralAnalyzerService();
const packages = new PackageGraphService();
const cycleDetector = new CycleDetectorService();

const tree = scanner.scan(process.cwd());
const graph = structural.analyze(tree);

const packageEdges = packages.build(graph);

const cycles = cycleDetector.detect(packageEdges);

console.log("===== PACKAGE DEPENDENCIES =====");
console.log(packageEdges);

console.log("\n===== DETECTED CYCLES =====");
console.log(cycles);