import { AnalysisPipelineService } from "./analysis-pipeline.service";
import { LocalScannerService } from "../../input/local/local-scanner.service";
import { LanguageDetectorService } from "../../detection/language-detector.service";
import { StructuralAnalyzerService } from "../../structural/structural-analyzer.service";
import { SemanticAnalyzerService } from "../../semantic/semantic-analyzer.service";
import { TreeSitterAnalyzer } from "../../semantic/analyzers/tree-sitter-analyzer";

const pipeline = new AnalysisPipelineService(
  new LocalScannerService(),
  new LanguageDetectorService(),
  new StructuralAnalyzerService(),
  new SemanticAnalyzerService([new TreeSitterAnalyzer()]),
);

const result = pipeline.run(process.cwd());

console.log(JSON.stringify(result.summary, null, 2));
console.log("HOTSPOTS", result.hotspots);
console.log("IMPACT ANALYSIS", result.impact);
console.log("ARCHITECTURE HEALTH", result.health);
console.log("CONFIDENCE", result.confidence);
console.log("BASELINE", result.baseline);