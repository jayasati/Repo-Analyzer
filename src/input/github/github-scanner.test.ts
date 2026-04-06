import { GithubScannerService } from './github-scanner.service';
import { AppLoggerService } from '../../common/logger/app-logger.service';

// Create a no-op logger mock for the test
const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  setCorrelationId: jest.fn(),
} as unknown as AppLoggerService;

const githubScanner = new GithubScannerService(mockLogger);

(async () => {
  const tree = await githubScanner.clone('https://github.com/nestjs/nest');
  console.log(JSON.stringify(tree, null, 2));
})();
