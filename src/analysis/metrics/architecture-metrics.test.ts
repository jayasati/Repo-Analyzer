import { runAnalysis } from "../utils/run-analysis";

const { packageEdges, cycles } = runAnalysis();

import { ArchitectureMetricsService } from "./architecture-metrics.service";
const metricsService = new ArchitectureMetricsService();

const modules = Array.from(
  new Set(packageEdges.flatMap(e => [e.from, e.to]))
);

const metrics = metricsService.compute(
  modules,
  packageEdges,
  cycles
);

console.log("===== ARCHITECTURE METRICS =====");
console.log(metrics);