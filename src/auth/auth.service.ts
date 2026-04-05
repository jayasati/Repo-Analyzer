import {
  Injectable, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { AuthUserPayload } from '../users/users.types';
import type { GithubValidatedUser } from './github.strategy';
import { GithubApiService } from '../github/github-api.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly githubApi: GithubApiService,
  ) {}

  async register(dto: RegisterDto): Promise<{ accessToken: string }> {
    const user = await this.usersService.create(dto);
    return { accessToken: this.sign(user) };
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await this.usersService.validatePassword(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return { accessToken: this.sign(this.toPayload(user)) };
  }

  async completeGithubLogin(
    oauth: GithubValidatedUser,
  ): Promise<{ accessToken: string; user: AuthUserPayload }> {
    const user = await this.usersService.upsertFromGithub(oauth);
    return { accessToken: this.sign(user), user };
  }

  async listGithubReposForUser(userId: string): Promise<{
    name: string;
    fullName: string;
    isPrivate: boolean;
    defaultBranch: string;
  }[]> {
    const token = await this.usersService.getDecryptedGithubToken(userId);
    const repos = await this.githubApi.listUserRepos(token);
    return repos.map(r => ({
      name:          r.name,
      fullName:      r.full_name,
      isPrivate:     r.private,
      defaultBranch: r.default_branch,
    }));
  }

  private toPayload(user: { id: string; email: string; role: string }): AuthUserPayload {
    return { id: user.id, email: user.email, role: user.role };
  }

  private sign(user: AuthUserPayload): string {
    return this.jwtService.sign({
      sub:   user.id,
      email: user.email,
      role:  user.role,
    });
  }
}
