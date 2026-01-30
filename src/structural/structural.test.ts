import { LocalScannerService } from '../input/local/local-scanner.service';
import { StructuralAnalyzerService } from './structural-analyzer.service';
import { computeStructuralMetrics } from './structural-metrics';

const scanner = new LocalScannerService();
const analyzer = new StructuralAnalyzerService();

const tree = scanner.scan(process.cwd());
const graph = analyzer.analyze(tree);
const metrics = computeStructuralMetrics(graph);

console.log(metrics);
