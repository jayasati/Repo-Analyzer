import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { TokenCryptoService } from '../common/crypto/token-crypto.service';

@Module({
  providers: [UsersService, TokenCryptoService],
  exports:   [UsersService],
})
export class UsersModule {}
