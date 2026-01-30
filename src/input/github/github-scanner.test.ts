import { GithubScannerService } from './github-scanner.service';
import { LocalScannerService } from '../local/local-scanner.service';

const localScanner = new LocalScannerService();
const githubScanner = new GithubScannerService();

(async () => {
  const tree = await githubScanner.clone(
    'https://github.com/nestjs/nest'
  );

  console.log(JSON.stringify(tree, null, 2));
})();
