import { Module } from '@nestjs/common';
import { DiagramPrepService } from './diagram-prep.service';
import { PlantUmlRendererService } from './plantuml-renderer.service';
import { DiagramFilterService } from './diagram-filter.service';

@Module({
  providers: [DiagramPrepService, PlantUmlRendererService, DiagramFilterService],
  exports: [DiagramPrepService, PlantUmlRendererService, DiagramFilterService],
})
export class DiagramModule {}
