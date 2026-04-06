import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';

export interface GithubValidatedUser {
  githubAccessToken: string;
  githubId: string;
  email: string;
  displayName?: string;
}

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor() {
    const clientID = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const callbackURL =
      process.env.GITHUB_CALLBACK_URL ??
      'http://localhost:3000/auth/github/callback';

    super({
      clientID: clientID ?? 'missing-client-id',
      clientSecret: clientSecret ?? 'missing-secret',
      callbackURL,
      scope: ['repo', 'user'],
    });
  }

  validate(
    accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): GithubValidatedUser {
    const email = (
      this.primaryEmail(profile) ?? this.noreplyEmail(profile)
    ).toLowerCase();

    return {
      githubAccessToken: accessToken,
      githubId: String(profile.id),
      email,
      displayName: profile.displayName ?? profile.username,
    };
  }

  private primaryEmail(profile: Profile): string | undefined {
    const emails = profile.emails;
    if (!emails?.length) return undefined;
    type EmailEntry = { value: string; primary?: boolean };
    const list = emails as EmailEntry[];
    const primary = list.find((e) => e.primary === true);
    return (primary ?? list[0]).value;
  }

  /** Stable fallback when GitHub omits emails (keeps account linking deterministic). */
  private noreplyEmail(profile: Profile): string {
    const username = profile.username ?? 'user';
    return `${profile.id}+${username}@users.noreply.github.com`;
  }
}
