import { Module } from '@nestjs/common';
import { InputModule } from './input/input.module';
import { DetectionModule } from './detection/detection.module';

@Module({
  imports: [InputModule,
    DetectionModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
