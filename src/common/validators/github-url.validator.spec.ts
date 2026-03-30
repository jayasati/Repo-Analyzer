import { IsGithubUrlConstraint } from './github-url.validator';

describe('IsGithubUrlConstraint', () => {
  let v: IsGithubUrlConstraint;
  beforeEach(() => { v = new IsGithubUrlConstraint(); });

  const valid = [
    'https://github.com/nestjs/nest',
    'https://github.com/owner/repo.git',
    'https://github.com/my-org/my-repo',
  ];

  const invalid = [
    'http://github.com/owner/repo',          // not HTTPS
    'https://evil.com/github.com/owner/repo', // wrong host
    'https://github.com/owner',              // no repo
    'file:///etc/passwd',                    // SSRF
    'https://169.254.169.254/latest/meta',   // AWS metadata
    'https://localhost/owner/repo',          // internal
    '',                                      // empty
    'not-a-url',                             // garbage
  ];

  valid.forEach(url => {
    it(`accepts ${url}`, () => expect(v.validate(url)).toBe(true));
  });

  invalid.forEach(url => {
    it(`rejects ${url}`, () => expect(v.validate(url)).toBe(false));
  });
});