import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { UsersService } from '../users/users.service';
import type { AuthUserPayload } from '../users/users.types';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private readonly usersService: UsersService) {
    super();
  }

  async validate(req: Request): Promise<AuthUserPayload> {
    const key =
      (req.headers['x-api-key'] as string) ?? (req.query['api_key'] as string);

    if (!key) throw new UnauthorizedException();

    const user = await this.usersService.validateApiKey(key);
    if (!user) throw new UnauthorizedException('Invalid API key');

    return user;
  }
}
