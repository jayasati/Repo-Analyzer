import { DiagramPrepService }      from '../../diagram/diagram-prep.service';
import { PlantUmlRendererService } from '../../diagram/plantuml-renderer.service';

/**
 * Groups all render-phase dependencies injected into AnalysisPipelineService.
 * Provided as a single token (PIPELINE_RENDERERS) to keep the constructor lean.
 */
export interface PipelineRenderers {
  diagramPrep: DiagramPrepService;
  renderer:    PlantUmlRendererService;
}
