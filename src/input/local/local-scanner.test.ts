import { LocalScannerService } from './local-scanner.service';

const scanner = new LocalScannerService();

const result = scanner.scan(process.cwd());

console.log(JSON.stringify(result, null, 2));

