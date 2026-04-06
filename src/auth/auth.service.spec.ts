import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { GithubApiService } from '../github/github-api.service';

const mockUserRow = {
  id: 'uuid-123',
  email: 'test@test.com',
  role: 'user',
  password: 'hashed',
};

const mockUsersService = {
  create: jest.fn(),
  findByEmailWithPassword: jest.fn(),
  validatePassword: jest.fn(),
  upsertFromGithub: jest.fn(),
  getDecryptedGithubToken: jest.fn(),
  getGithubAccessTokenIfPresent: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-token'),
};

const mockGithubApi = {
  listUserRepos: jest.fn(),
};

describe('AuthService', () => {
  let svc: AuthService;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: GithubApiService, useValue: mockGithubApi },
      ],
    }).compile();
    svc = mod.get(AuthService);
    jest.clearAllMocks();
  });

  it('register() returns access token', async () => {
    mockUsersService.create.mockResolvedValue({
      id: mockUserRow.id,
      email: mockUserRow.email,
      role: mockUserRow.role,
    });
    const result = await svc.register({
      email: 'a@b.com',
      password: 'Pass123!',
    });
    expect(result.accessToken).toBe('mock-token');
  });

  it('login() throws UnauthorizedException for unknown email', async () => {
    mockUsersService.findByEmailWithPassword.mockResolvedValue(null);
    await expect(
      svc.login({ email: 'x@x.com', password: 'p' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('login() throws UnauthorizedException for wrong password', async () => {
    mockUsersService.findByEmailWithPassword.mockResolvedValue(mockUserRow);
    mockUsersService.validatePassword.mockResolvedValue(false);
    await expect(
      svc.login({ email: 'test@test.com', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('login() returns access token for valid credentials', async () => {
    mockUsersService.findByEmailWithPassword.mockResolvedValue(mockUserRow);
    mockUsersService.validatePassword.mockResolvedValue(true);
    const result = await svc.login({
      email: 'test@test.com',
      password: 'Pass123!',
    });
    expect(result.accessToken).toBe('mock-token');
  });

  it('completeGithubLogin() returns token and safe user', async () => {
    const payload = {
      githubAccessToken: 'gho_test',
      githubId: '99',
      email: 'gh@example.com',
    };
    mockUsersService.upsertFromGithub.mockResolvedValue({
      id: 'u1',
      email: payload.email,
      role: 'user',
    });
    const out = await svc.completeGithubLogin(payload);
    expect(out.accessToken).toBe('mock-token');
    expect(out.user).toEqual({ id: 'u1', email: payload.email, role: 'user' });
    expect(mockUsersService.upsertFromGithub).toHaveBeenCalledWith(payload);
  });

  it('listGithubReposForUser() maps API fields', async () => {
    mockUsersService.getGithubAccessTokenIfPresent.mockResolvedValue('token');
    mockGithubApi.listUserRepos.mockResolvedValue([
      {
        id: 1,
        name: 'r',
        full_name: 'o/r',
        private: true,
        default_branch: 'main',
      },
    ]);
    const rows = await svc.listGithubReposForUser('user-id');
    expect(rows).toEqual([
      { name: 'r', fullName: 'o/r', isPrivate: true, defaultBranch: 'main' },
    ]);
  });
});
