import { Module } from '@nestjs/common';
import { InputModule } from './input/input.module';
import { DetectionModule } from './detection/detection.module';
import { StructuralAnalyzerService } from './structural/structural-analyzer.service';
import { CoreModule } from './core/core.module';

@Module({
  imports: [
      CoreModule,
          ],
  controllers: [],
  providers: [],
})
export class AppModule {}
