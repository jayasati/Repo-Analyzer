import { AnalyzerService } from './analyzer.service';
import { LocalScannerService } from '../input/local/local-scanner.service';
import { GithubScannerService } from '../input/github/github-scanner.service';
import { LanguageDetectorService } from '../detection/language-detector.service';
import { StructuralAnalyzerService } from '../structural/structural-analyzer.service';

const analyzer = new AnalyzerService(
  new LocalScannerService(),
  new GithubScannerService(),
  new LanguageDetectorService(),
  new StructuralAnalyzerService(),
);

(async () => {
  const result = await analyzer.analyzeGitHub("https://github.com/jayasati/Repo-Analyzer");
  console.log(JSON.stringify(result, null, 2));
})();
