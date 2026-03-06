export interface ArchitectureMetrics {

  moduleCount: number;

  dependencyCount: number;

  cycleCount: number;

  averageFanIn: number;

  averageFanOut: number;

  dependencyDensity: number;

  maxFanOut: number;

}