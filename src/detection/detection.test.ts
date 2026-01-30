import { LocalScannerService } from '../input/local/local-scanner.service';
import { LanguageDetectorService } from './language-detector.service';

const scanner = new LocalScannerService();
const detector = new LanguageDetectorService();

const tree = scanner.scan(process.cwd());
const result = detector.detect(tree);

console.log(JSON.stringify(result, null, 2));
