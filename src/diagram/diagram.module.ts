// NEW FILE: src/diagram/diagram.module.ts

import { Module } from '@nestjs/common';
import { DiagramPrepService } from './diagram-prep.service';
import { PlantUmlRendererService } from './plantuml-renderer.service';

@Module({
  providers: [DiagramPrepService, PlantUmlRendererService],
  exports: [DiagramPrepService, PlantUmlRendererService],
})
export class DiagramModule {}
