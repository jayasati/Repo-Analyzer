import { runAnalysis } from "../utils/run-analysis";

const { packageEdges, cycles } = runAnalysis();

console.log("===== PACKAGE DEPENDENCIES =====");
console.log(packageEdges);

console.log("\n===== DETECTED CYCLES =====");
console.log(cycles);