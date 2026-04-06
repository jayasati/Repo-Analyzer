// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { TokenCryptoService } from '../common/crypto/token-crypto.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],  // 👈 add this
  providers: [UsersService, TokenCryptoService],
  exports: [UsersService],
})
export class UsersModule {}