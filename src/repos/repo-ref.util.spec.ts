import { BadRequestException } from '@nestjs/common';
import { parseGithubRepoFullName } from './repo-ref.util';

describe('parseGithubRepoFullName', () => {
  it('parses owner/repo', () => {
    expect(parseGithubRepoFullName('octocat/Hello-World')).toEqual({
      owner: 'octocat',
      repo: 'Hello-World',
      fullName: 'octocat/Hello-World',
    });
  });

  it('parses https URL', () => {
    expect(
      parseGithubRepoFullName('https://github.com/octocat/Hello-World'),
    ).toEqual({
      owner: 'octocat',
      repo: 'Hello-World',
      fullName: 'octocat/Hello-World',
    });
  });

  it('parses URL with .git suffix', () => {
    expect(
      parseGithubRepoFullName('https://github.com/octocat/Hello-World.git'),
    ).toEqual({
      owner: 'octocat',
      repo: 'Hello-World',
      fullName: 'octocat/Hello-World',
    });
  });

  it('rejects invalid input', () => {
    expect(() => parseGithubRepoFullName('not-a-repo')).toThrow(
      BadRequestException,
    );
  });
});
