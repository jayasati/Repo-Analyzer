import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService }    from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy }    from './jwt.strategy';
import { ApiKeyStrategy } from './api-key.strategy';
import { UsersModule }    from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({
      secret:       process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions:  { expiresIn: '7d' },
    }),
  ],
  providers:   [AuthService, JwtStrategy, ApiKeyStrategy],
  controllers: [AuthController],
  exports:     [AuthService, JwtModule],
})
export class AuthModule {}