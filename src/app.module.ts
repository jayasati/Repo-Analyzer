import { Module } from '@nestjs/common';
import { InputModule } from './input/input.module';
import { DetectionModule } from './detection/detection.module';
import { StructuralAnalyzerService } from './structural/structural-analyzer.service';

@Module({
  imports: [InputModule,
           DetectionModule,
           StructuralAnalyzerService, 
                    
          ],
  controllers: [],
  providers: [],
})
export class AppModule {}
