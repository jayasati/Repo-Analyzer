import { runAnalysis } from "../utils/run-analysis";

const { packageEdges, cycles, smells } = runAnalysis();

console.log("===== PACKAGE DEPENDENCIES =====");
console.log(packageEdges);

console.log("\n===== CYCLES =====");
console.log(cycles);

console.log("\n===== ARCHITECTURE SMELLS =====");
console.log(smells);