import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity }   from './entities/user.entity';
import { ApiKeyEntity } from './entities/api-key.entity';
import { UsersService } from './users.service';

@Module({
  imports:   [TypeOrmModule.forFeature([UserEntity, ApiKeyEntity])],
  providers: [UsersService],
  exports:   [UsersService],
})
export class UsersModule {}