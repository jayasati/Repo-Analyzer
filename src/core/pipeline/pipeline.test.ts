import { AnalysisPipelineService } from "./analysis-pipeline.service";

import { LocalScannerService } from "../../input/local/local-scanner.service";
import { LanguageDetectorService } from "../../detection/language-detector.service";
import { StructuralAnalyzerService } from "../../structural/structural-analyzer.service";
import { SemanticAnalyzerService } from "../../semantic/semantic-analyzer.service";

import { TypescriptAnalyzer } from "../../semantic/analyzers/typescript-analyzer";

const pipeline = new AnalysisPipelineService(
  new LocalScannerService(),
  new LanguageDetectorService(),
  new StructuralAnalyzerService(),
  new SemanticAnalyzerService([
    new TypescriptAnalyzer()
  ])
);

const result = pipeline.run(process.cwd());

console.log(JSON.stringify(result.summary, null, 2));

console.log("HOTSPOTS");
console.log(result.hotspots);

console.log("IMPACT ANALYSIS");
console.log(result.impact);