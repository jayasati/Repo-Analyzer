import { Module } from '@nestjs/common';
import { GateController } from './gate.controller';
import { GateService } from './gate.service';
import { CacheModule } from '../cache/cache.module';

// @ts-ignore – module declaration lives in gate.controller.ts above
@Module({
  imports: [CacheModule],
  providers: [GateService],
  controllers: [GateController],
  exports: [GateService],
})
export class GateModule {}
