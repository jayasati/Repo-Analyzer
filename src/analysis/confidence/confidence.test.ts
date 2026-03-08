import { runAnalysis } from "../utils/run-analysis";
import { ConfidenceService } from "./confidence.service";

const { metrics, smells, cycles } = runAnalysis();

const confidenceService = new ConfidenceService();

const result = confidenceService.compute(
  metrics,
  smells,
  cycles
);

console.log("===== CONFIDENCE SCORE =====");
console.log(result);