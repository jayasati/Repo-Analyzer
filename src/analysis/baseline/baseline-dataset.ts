import { ArchitectureBaseline } from "./baseline.types";

export const BASELINES: ArchitectureBaseline[] = [

  {
    name: "student-project",
    metrics: {
      moduleCount: 6,
      dependencyCount: 15,
      cycleCount: 3,
      averageFanIn: 2,
      averageFanOut: 3,
      dependencyDensity: 0.35,
      maxFanOut: 6
    }
  },

  {
    name: "open-source",
    metrics: {
      moduleCount: 15,
      dependencyCount: 40,
      cycleCount: 1,
      averageFanIn: 2,
      averageFanOut: 2,
      dependencyDensity: 0.18,
      maxFanOut: 4
    }
  },

  {
    name: "production-system",
    metrics: {
      moduleCount: 25,
      dependencyCount: 50,
      cycleCount: 0,
      averageFanIn: 1.5,
      averageFanOut: 1.5,
      dependencyDensity: 0.12,
      maxFanOut: 3
    }
  }

];