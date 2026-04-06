import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { GithubApiService } from '../github/github-api.service';
import { ANALYSIS_QUEUE } from '../queue/queue.constants';
import { AppLoggerService } from '../common/logger/app-logger.service';
import { parseGithubRepoFullName } from './repo-ref.util';

export type ScanJobStatus = 'queued';

@Injectable()
export class ReposService {
  constructor(
    @InjectQueue(ANALYSIS_QUEUE) private readonly queue: Queue,
    private readonly users: UsersService,
    private readonly github: GithubApiService,
    private readonly logger: AppLoggerService,
  ) {}

  async queueScan(
    userId: string,
    repoInput: string,
  ): Promise<{
    jobId: string;
    status: ScanJobStatus;
    fullName: string;
  }> {
    const { fullName } = parseGithubRepoFullName(repoInput);
    const token = await this.users.getDecryptedGithubToken(userId);
    const detail = await this.github.assertUserOwnsRepo(token, fullName);

    const jobId = randomUUID();
    const source = `https://github.com/${detail.full_name}`;

    await this.queue.add(
      'analyze',
      { jobId, source, isGitHub: true, requestedAt: new Date().toISOString() },
      {
        jobId,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
        attempts: 1,
      },
    );

    this.logger.log(
      `Scan queued for ${fullName} (job ${jobId})`,
      'ReposService',
    );

    return { jobId, status: 'queued', fullName: detail.full_name };
  }
}
