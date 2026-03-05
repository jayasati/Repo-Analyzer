import { AnalyzerService } from './analyzer.service';
import { LocalScannerService } from '../input/local/local-scanner.service';
import { GithubScannerService } from '../input/github/github-scanner.service';
import { LanguageDetectorService } from '../detection/language-detector.service';
import { StructuralAnalyzerService } from '../structural/structural-analyzer.service';
import { SemanticAnalyzerService } from '../semantic/semantic-analyzer.service';
import { TypescriptAnalyzer } from '../semantic/analyzers/typescript-analyzer';

const analyzer = new AnalyzerService(
  new LocalScannerService(),
  new GithubScannerService(),
  new LanguageDetectorService(),
  new StructuralAnalyzerService(),
  new SemanticAnalyzerService([new TypescriptAnalyzer()])
);

(async () => {
  const result = await analyzer.analyzeLocal(process.cwd());

  console.log(JSON.stringify(result.semantic, null, 2));
})();