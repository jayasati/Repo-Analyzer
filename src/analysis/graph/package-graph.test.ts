import { LocalScannerService } from '../../input/local/local-scanner.service';
import { StructuralAnalyzerService } from '../../structural/structural-analyzer.service';
import { PackageGraphService } from './package-graph.service';

const scanner = new LocalScannerService();
const analyzer = new StructuralAnalyzerService();
const packageGraph = new PackageGraphService();

const tree = scanner.scan(process.cwd());
const graph = analyzer.analyze(tree);

const packages = packageGraph.build(graph);

console.log('===== PACKAGE DEPENDENCIES =====');
console.log(packages);
