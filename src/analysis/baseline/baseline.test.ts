import { runAnalysis } from '../utils/run-analysis';
import { BaselineComparatorService } from './baseline-comparator.service';

const { metrics } = runAnalysis();

const comparator = new BaselineComparatorService();

const results = comparator.compare(metrics);

console.log('===== BASELINE COMPARISON =====');

results.forEach((r) => {
  console.log(`${r.name}: ${r.similarity}`);
});

console.log('\nPredicted Architecture Style:');
console.log(results[0].name);
