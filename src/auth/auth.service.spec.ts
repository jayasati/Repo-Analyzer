import { Test } from '@nestjs/testing';
import { AuthService }  from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService }   from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

const mockUser = {
  id: 'uuid-123', email: 'test@test.com', role: 'user',
  validatePassword: jest.fn(),
};

const mockUsersService = {
  create:        jest.fn(),
  findByEmail:   jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-token'),
};

describe('AuthService', () => {
  let svc: AuthService;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService,   useValue: mockJwtService   },
      ],
    }).compile();
    svc = mod.get(AuthService);
    jest.clearAllMocks();
  });

  it('register() returns access token', async () => {
    mockUsersService.create.mockResolvedValue(mockUser);
    const result = await svc.register({ email: 'a@b.com', password: 'Pass123!' });
    expect(result.accessToken).toBe('mock-token');
  });

  it('login() throws UnauthorizedException for unknown email', async () => {
    mockUsersService.findByEmail.mockResolvedValue(null);
    await expect(svc.login({ email: 'x@x.com', password: 'p' }))
      .rejects.toThrow(UnauthorizedException);
  });

  it('login() throws UnauthorizedException for wrong password', async () => {
    mockUsersService.findByEmail.mockResolvedValue(mockUser);
    mockUser.validatePassword.mockResolvedValue(false);
    await expect(svc.login({ email: 'test@test.com', password: 'wrong' }))
      .rejects.toThrow(UnauthorizedException);
  });

  it('login() returns access token for valid credentials', async () => {
    mockUsersService.findByEmail.mockResolvedValue(mockUser);
    mockUser.validatePassword.mockResolvedValue(true);
    const result = await svc.login({ email: 'test@test.com', password: 'Pass123!' });
    expect(result.accessToken).toBe('mock-token');
  });
});