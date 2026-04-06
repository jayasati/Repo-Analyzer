import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { SlackService } from './slack.service';
import { EmailService } from './email.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule],
  providers: [NotificationService, SlackService, EmailService],
  exports: [EmailService],
})
export class NotificationModule {}
