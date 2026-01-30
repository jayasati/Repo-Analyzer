import { GithubScannerService } from './github-scanner.service';
import { LocalScannerService } from '../local/local-scanner.service';

const localScanner = new LocalScannerService();
const githubScanner = new GithubScannerService(localScanner);

(async () => {
  const tree = await githubScanner.scan(
    'https://github.com/nestjs/nest'
  );

  console.log(JSON.stringify(tree, null, 2));
})();
