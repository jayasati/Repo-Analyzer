import { ArchitectureScoreService } from './architecture-score.service';
import { ArchitectureMetricsService } from '../metrics/architecture-metrics.service';
import { runAnalysis } from '../utils/run-analysis';

const { packageEdges, cycles, smells } = runAnalysis();

// ArchitectureScoreService now depends on ArchitectureMetricsService via
// constructor injection — pass it explicitly when instantiating outside NestJS DI.
const metricsService = new ArchitectureMetricsService();
const scoring = new ArchitectureScoreService(metricsService);

const score = scoring.compute(packageEdges, smells, cycles);

console.log('===== ARCHITECTURE SCORE =====');
console.log('Overall:    ', score.overall);
console.log('Modularity: ', score.breakdown.modularity);
console.log('Coupling:   ', score.breakdown.coupling);
console.log('Smells:     ', score.breakdown.smells);

console.log('\n===== BREAKDOWN =====');
console.log(score.breakdown);
