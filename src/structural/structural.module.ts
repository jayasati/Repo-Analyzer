import { Module } from '@nestjs/common';
import { StructuralAnalyzerService } from './structural-analyzer.service';

@Module({
  providers: [StructuralAnalyzerService],
  exports: [StructuralAnalyzerService],
})
export class StructuralModule {}
