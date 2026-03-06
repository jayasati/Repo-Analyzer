
import { ArchitectureScoreService } from "./architecture-score.service";

import { runAnalysis } from "../utils/run-analysis";

const { packageEdges, cycles, smells } = runAnalysis();

const scoring = new ArchitectureScoreService();



const score = scoring.compute(packageEdges, smells,cycles);

console.log("===== ARCHITECTURE SCORE =====");
console.log(score);

console.log("\n===== BREAKDOWN =====");
console.log(score.breakdown);