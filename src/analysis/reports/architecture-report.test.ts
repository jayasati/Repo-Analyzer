import { LocalScannerService } from "../../input/local/local-scanner.service";
import { StructuralAnalyzerService } from "../../structural/structural-analyzer.service";
import { PackageGraphService } from "../graph/package-graph.service";
import { CycleDetectorService } from "../cycles/cycle-detector.service";
import { SmellDetectorService } from "../smells/smell-detector.service";
import { ArchitectureScoreService } from "../scoring/architecture-score.service";
import { ArchitectureReportService } from "./architecture-report.service";
import { RecommendationService } from "./recommend/recommendation.service"; 


const scanner = new LocalScannerService();
const structural = new StructuralAnalyzerService();
const packageGraph = new PackageGraphService();
const cycleDetector = new CycleDetectorService();
const smellDetector = new SmellDetectorService();
const scoring = new ArchitectureScoreService();
const reportService = new ArchitectureReportService();
const recommendationService = new RecommendationService();

const tree = scanner.scan(process.cwd());

const graph = structural.analyze(tree);

const packageEdges = packageGraph.build(graph);

const cycles = cycleDetector.detect(packageEdges);

const smells = smellDetector.detect(packageEdges);

const score = scoring.compute(packageEdges, smells);

const modules = Array.from(
  new Set(packageEdges.flatMap(e => [e.from, e.to]))
);

const recommendations = recommendationService.generate(
  smells,
  cycles,
  score.overall
);

const report = reportService.generate({
  projectName: "repo-analyzer",
  modules,
  score,
  smells,
  cycles,
  recommendations
});

console.log("===== CLI REPORT =====");
console.log(report.cli);

console.log("\n===== JSON REPORT =====");
console.log(report.json);

console.log("\n===== MARKDOWN REPORT =====");
console.log(report.markdown);