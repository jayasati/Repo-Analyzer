import { BadRequestException } from '@nestjs/common';
import { APP_CONSTANTS } from '../common/constants/app.constants';

/**
 * Accepts `owner/repo` or `https://github.com/owner/repo` (.git optional).
 */
export function parseGithubRepoFullName(input: string): { owner: string; repo: string; fullName: string } {
  const s = input.trim().replace(/\/+$/, '');
  const urlMatch = s.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(\.git)?$/i);
  if (urlMatch && APP_CONSTANTS.GITHUB_URL_REGEX.test(s.split('?')[0])) {
    const owner = urlMatch[1];
    const repo = urlMatch[2];
    return { owner, repo, fullName: `${owner}/${repo}` };
  }

  const slash = s.indexOf('/');
  if (slash > 0 && slash < s.length - 1 && /^[\w.-]+\/[\w.-]+$/.test(s)) {
    const owner = s.slice(0, slash);
    const repo = s.slice(slash + 1);
    return { owner, repo, fullName: s };
  }

  throw new BadRequestException(
    'Provide owner/repo or a GitHub HTTPS URL (https://github.com/owner/repo)',
  );
}
