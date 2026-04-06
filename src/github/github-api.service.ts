import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

const GITHUB_API = 'https://api.github.com';

export interface GithubRepoListItem {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
}

export interface GithubRepoDetail extends GithubRepoListItem {
  owner: { login: string };
  permissions?: {
    admin?: boolean;
    maintain?: boolean;
    push?: boolean;
    triage?: boolean;
    pull?: boolean;
  };
}

@Injectable()
export class GithubApiService {
  private headers(
    token: string,
    accept = 'application/vnd.github+json',
  ): HeadersInit {
    return {
      Authorization: `Bearer ${token}`,
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  async getAuthenticatedUserLogin(accessToken: string): Promise<string> {
    const res = await fetch(`${GITHUB_API}/user`, {
      headers: this.headers(accessToken),
    });
    if (res.status === 401)
      throw new UnauthorizedException('GitHub token rejected');
    if (!res.ok) {
      throw new BadGatewayException(`GitHub /user failed: ${res.status}`);
    }
    const body = (await res.json()) as { login: string };
    if (!body.login)
      throw new BadGatewayException('Invalid GitHub /user response');
    return body.login;
  }

  /**
   * Lists repositories the token can access (respects repo + user scopes).
   */
  async listUserRepos(accessToken: string): Promise<GithubRepoListItem[]> {
    const out: GithubRepoListItem[] = [];
    let page = 1;
    const perPage = 100;

    for (;;) {
      const url = new URL(`${GITHUB_API}/user/repos`);
      url.searchParams.set('per_page', String(perPage));
      url.searchParams.set('page', String(page));
      url.searchParams.set('sort', 'updated');

      const res = await fetch(url.toString(), {
        headers: this.headers(accessToken),
      });
      if (res.status === 401)
        throw new UnauthorizedException('GitHub token rejected');
      if (!res.ok) {
        throw new BadGatewayException(
          `GitHub /user/repos failed: ${res.status}`,
        );
      }

      const batch = (await res.json()) as GithubRepoListItem[];
      out.push(...batch);
      if (batch.length < perPage) break;
      page += 1;
      if (page > 50) break; // safety cap
    }

    return out;
  }

  async getRepo(
    accessToken: string,
    owner: string,
    repo: string,
  ): Promise<GithubRepoDetail> {
    const res = await fetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      {
        headers: this.headers(accessToken),
      },
    );
    if (res.status === 401)
      throw new UnauthorizedException('GitHub token rejected');
    if (res.status === 404) {
      throw new ForbiddenException(
        'Repository not found or not accessible with this token',
      );
    }
    if (!res.ok) {
      throw new BadGatewayException(`GitHub /repos failed: ${res.status}`);
    }
    return (await res.json()) as GithubRepoDetail;
  }

  /**
   * Ensures the authenticated user is the owner of the repo (personal account ownership).
   */
  async listBranches(
    accessToken: string,
    owner: string,
    repo: string,
  ): Promise<{ name: string }[]> {
    const res = await fetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=30`,
      { headers: this.headers(accessToken) },
    );
    if (res.status === 401)
      throw new UnauthorizedException('GitHub token rejected');
    if (!res.ok) return [];
    const body = (await res.json()) as { name: string }[];
    return body.map((b) => ({ name: b.name }));
  }

  async assertUserOwnsRepo(
    accessToken: string,
    fullName: string,
  ): Promise<GithubRepoDetail> {
    const slash = fullName.indexOf('/');
    if (slash < 1 || slash === fullName.length - 1) {
      throw new ForbiddenException('Invalid repository full name');
    }
    const owner = fullName.slice(0, slash);
    const name = fullName.slice(slash + 1);
    const login = await this.getAuthenticatedUserLogin(accessToken);
    if (owner.toLowerCase() !== login.toLowerCase()) {
      throw new ForbiddenException(
        'You can only scan repositories you own on your personal account',
      );
    }
    return this.getRepo(accessToken, owner, name);
  }
}
