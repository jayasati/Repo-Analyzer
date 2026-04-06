import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { GithubValidatedUser } from './github.strategy';
import type { AuthUserPayload } from '../users/users.types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive a JWT' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async me(@Request() req: { user: AuthUserPayload }) {
    const githubLinked = await this.usersService.isGithubLinked(req.user.id);
    return {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      githubLinked,
    };
  }

  @Get('github')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'Start GitHub OAuth (redirects to GitHub)' })
  githubAuth(): void {
    // Passport sends redirect; this handler is not reached.
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth callback — issues JWT' })
  async githubCallback(
    @Request() req: { user: GithubValidatedUser },
    @Res() res: Response,
  ): Promise<void> {
    const { accessToken, user } = await this.authService.completeGithubLogin(
      req.user,
    );
    const redirectBase = process.env.GITHUB_OAUTH_SUCCESS_URL;
    if (redirectBase) {
      const url = new URL(redirectBase);
      url.searchParams.set('access_token', accessToken);
      res.redirect(302, url.toString());
      return;
    }
    res.status(200).json({ accessToken, user });
  }

  @Get('github/repos/:owner/:repo/branches')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List branches for a repository (uses stored GitHub token)',
  })
  githubRepoBranches(
    @Request() req: { user: AuthUserPayload },
    @Param('owner') owner: string,
    @Param('repo') repo: string,
  ) {
    return this.authService.listGithubRepoBranches(req.user.id, owner, repo);
  }

  @Get('github/repos')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'List GitHub repositories for the linked account (server-side token)',
  })
  githubRepos(@Request() req: { user: AuthUserPayload }) {
    return this.authService.listGithubReposForUser(req.user.id);
  }

  @Post('api-keys')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a new API key' })
  generateKey(
    @Request() req: { user: { id: string } },
    @Body() body: { name?: string },
  ) {
    return this.usersService.generateApiKey(req.user.id, body.name);
  }

  @Get('api-keys')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all API keys' })
  listKeys(@Request() req: { user: { id: string } }) {
    return this.usersService.listApiKeys(req.user.id);
  }

  @Delete('api-keys/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke an API key' })
  revokeKey(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.usersService.revokeApiKey(id, req.user.id);
  }
}
