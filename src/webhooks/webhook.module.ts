import { Module } from '@nestjs/common';
import { BullModule }      from '@nestjs/bullmq';
import { WebhookController } from './webhook.controller';
import { ANALYSIS_QUEUE }    from '../queue/queue.constants';

@Module({
  imports:     [BullModule.registerQueue({ name: ANALYSIS_QUEUE })],
  controllers: [WebhookController],
})
export class WebhookModule {}