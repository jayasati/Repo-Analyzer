import { ArchitectureScoreService } from '../scoring/architecture-score.service';
import { ArchitectureReportService } from './architecture-report.service';
import { RecommendationService } from './recommend/recommendation.service';

import { runAnalysis } from '../utils/run-analysis';
import { ArchitectureMetricsService } from '../metrics/architecture-metrics.service';

const { packageEdges, cycles, smells } = runAnalysis();
const metricsService = new ArchitectureMetricsService();
const scoring = new ArchitectureScoreService(metricsService);
const reportService = new ArchitectureReportService();
const recommendationService = new RecommendationService();

const score = scoring.compute(packageEdges, smells, cycles);

const modules = Array.from(
  new Set(packageEdges.flatMap((e) => [e.from, e.to])),
);

const recommendations = recommendationService.generate(
  smells,
  cycles,
  score.overall,
);

const report = reportService.generate({
  projectName: 'repo-analyzer',
  modules,
  score,
  smells,
  cycles,
  recommendations,
});

console.log('===== CLI REPORT =====');
console.log(report.cli);

console.log('\n===== JSON REPORT =====');
console.log(report.json);

console.log('\n===== MARKDOWN REPORT =====');
console.log(report.markdown);
