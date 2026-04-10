import { DiagramPrepService } from '../../diagram/diagram-prep.service';
import { PlantUmlRendererService } from '../../diagram/plantuml-renderer.service';
import { DiagramFilterService } from '../../diagram/diagram-filter.service';

/**
 * Groups all render-phase dependencies injected into AnalysisPipelineService.
 * Provided as a single token (PIPELINE_RENDERERS) to keep the constructor lean.
 */
export interface PipelineRenderers {
  diagramPrep: DiagramPrepService;
  renderer: PlantUmlRendererService;
  diagramFilter: DiagramFilterService;
}
