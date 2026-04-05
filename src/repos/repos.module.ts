import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReposController } from './repos.controller';
import { ReposService } from './repos.service';
import { UsersModule } from '../users/users.module';
import { GithubModule } from '../github/github.module';
import { ANALYSIS_QUEUE } from '../queue/queue.constants';

@Module({
  imports: [
    UsersModule,
    GithubModule,
    BullModule.registerQueue({ name: ANALYSIS_QUEUE }),
  ],
  controllers: [ReposController],
  providers:   [ReposService],
})
export class ReposModule {}
