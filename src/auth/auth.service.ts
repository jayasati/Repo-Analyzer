import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto }  from './dto/register.dto';
import { LoginDto }     from './dto/login.dto';
import { UserEntity }   from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService:   JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ accessToken: string }> {
    const user = await this.usersService.create(dto);
    return { accessToken: this.sign(user) };
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await user.validatePassword(dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return { accessToken: this.sign(user) };
  }

  private sign(user: UserEntity): string {
    return this.jwtService.sign({
      sub:   user.id,
      email: user.email,
      role:  user.role,
    });
  }
}