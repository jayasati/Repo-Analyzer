import { Module } from '@nestjs/common';
import { InputModule } from './input/input.module';
import { DetectionModule } from './detection/detection.module';
import { StructuralAnalyzerService } from './structural/structural-analyzer.service';
import { CoreModule } from './core/core.module';
import { ApiModule } from './api/api.module';

@Module({
  imports: [
      CoreModule,
      ApiModule,
          ],
  controllers: [],
  providers: [],
})
export class AppModule {}
