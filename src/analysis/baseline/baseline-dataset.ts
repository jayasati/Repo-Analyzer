import { ArchitectureBaseline } from './baseline.types';

// ── Baseline dataset ───────────────────────────────────────────────────────────
//
// Each baseline represents a typical "healthy, mid-size" repo for that
// framework (15–40 modules, low cycles, moderate coupling).
//
// Metrics key:
//   moduleCount        — number of top-level packages
//   dependencyCount    — package-level directed edges
//   cycleCount         — circular dependency groups
//   averageFanIn       — average incoming edges per module
//   averageFanOut      — average outgoing edges per module
//   dependencyDensity  — dependencyCount / (moduleCount × (moduleCount − 1))
//   maxFanOut          — highest single fan-out value in the repo

export const BASELINES: ArchitectureBaseline[] = [
  // ── Generic / language-agnostic ─────────────────────────────────────────

  {
    name: 'student-project',
    metrics: {
      moduleCount: 6,
      dependencyCount: 15,
      cycleCount: 3,
      averageFanIn: 2.0,
      averageFanOut: 3.0,
      dependencyDensity: 0.35,
      maxFanOut: 6,
    },
  },
  {
    name: 'open-source-library',
    metrics: {
      moduleCount: 15,
      dependencyCount: 40,
      cycleCount: 1,
      averageFanIn: 2.0,
      averageFanOut: 2.0,
      dependencyDensity: 0.18,
      maxFanOut: 4,
    },
  },
  {
    name: 'production-monolith',
    metrics: {
      moduleCount: 25,
      dependencyCount: 50,
      cycleCount: 0,
      averageFanIn: 1.5,
      averageFanOut: 1.5,
      dependencyDensity: 0.12,
      maxFanOut: 3,
    },
  },

  // ── TypeScript / JavaScript ──────────────────────────────────────────────

  {
    name: 'nestjs-api',
    metrics: {
      moduleCount: 18,
      dependencyCount: 42,
      cycleCount: 0,
      averageFanIn: 1.8,
      averageFanOut: 2.3,
      dependencyDensity: 0.13,
      maxFanOut: 8,
    },
  },
  {
    name: 'express-rest-api',
    metrics: {
      moduleCount: 10,
      dependencyCount: 18,
      cycleCount: 0,
      averageFanIn: 1.3,
      averageFanOut: 1.8,
      dependencyDensity: 0.2,
      maxFanOut: 4,
    },
  },
  {
    name: 'nextjs-fullstack',
    metrics: {
      moduleCount: 14,
      dependencyCount: 28,
      cycleCount: 0,
      averageFanIn: 1.5,
      averageFanOut: 2.0,
      dependencyDensity: 0.15,
      maxFanOut: 5,
    },
  },
  {
    name: 'angular-spa',
    metrics: {
      moduleCount: 20,
      dependencyCount: 55,
      cycleCount: 0,
      averageFanIn: 2.1,
      averageFanOut: 2.8,
      dependencyDensity: 0.14,
      maxFanOut: 10,
    },
  },

  // ── Python ───────────────────────────────────────────────────────────────

  {
    name: 'django-web-app',
    metrics: {
      moduleCount: 16,
      dependencyCount: 35,
      cycleCount: 0,
      averageFanIn: 1.7,
      averageFanOut: 2.2,
      dependencyDensity: 0.14,
      maxFanOut: 6,
    },
  },
  {
    name: 'fastapi-service',
    metrics: {
      moduleCount: 10,
      dependencyCount: 20,
      cycleCount: 0,
      averageFanIn: 1.4,
      averageFanOut: 2.0,
      dependencyDensity: 0.22,
      maxFanOut: 5,
    },
  },
  {
    name: 'flask-microservice',
    metrics: {
      moduleCount: 8,
      dependencyCount: 14,
      cycleCount: 0,
      averageFanIn: 1.2,
      averageFanOut: 1.8,
      dependencyDensity: 0.25,
      maxFanOut: 4,
    },
  },

  // ── Java / Kotlin ────────────────────────────────────────────────────────

  {
    name: 'spring-boot-api',
    metrics: {
      moduleCount: 20,
      dependencyCount: 45,
      cycleCount: 0,
      averageFanIn: 1.7,
      averageFanOut: 2.3,
      dependencyDensity: 0.11,
      maxFanOut: 8,
    },
  },
  {
    name: 'ktor-service',
    metrics: {
      moduleCount: 12,
      dependencyCount: 22,
      cycleCount: 0,
      averageFanIn: 1.4,
      averageFanOut: 1.8,
      dependencyDensity: 0.15,
      maxFanOut: 5,
    },
  },

  // ── Go ────────────────────────────────────────────────────────────────────

  {
    name: 'gin-rest-api',
    metrics: {
      moduleCount: 10,
      dependencyCount: 16,
      cycleCount: 0,
      averageFanIn: 1.2,
      averageFanOut: 1.6,
      dependencyDensity: 0.18,
      maxFanOut: 4,
    },
  },

  // ── C# ────────────────────────────────────────────────────────────────────

  {
    name: 'aspnet-core-api',
    metrics: {
      moduleCount: 18,
      dependencyCount: 40,
      cycleCount: 0,
      averageFanIn: 1.7,
      averageFanOut: 2.2,
      dependencyDensity: 0.13,
      maxFanOut: 7,
    },
  },

  // ── Ruby ──────────────────────────────────────────────────────────────────

  {
    name: 'rails-web-app',
    metrics: {
      moduleCount: 18,
      dependencyCount: 38,
      cycleCount: 0,
      averageFanIn: 1.6,
      averageFanOut: 2.1,
      dependencyDensity: 0.12,
      maxFanOut: 7,
    },
  },

  // ── PHP ───────────────────────────────────────────────────────────────────

  {
    name: 'laravel-app',
    metrics: {
      moduleCount: 16,
      dependencyCount: 34,
      cycleCount: 0,
      averageFanIn: 1.6,
      averageFanOut: 2.1,
      dependencyDensity: 0.14,
      maxFanOut: 7,
    },
  },

  // ── Rust ──────────────────────────────────────────────────────────────────

  {
    name: 'actix-web-service',
    metrics: {
      moduleCount: 10,
      dependencyCount: 15,
      cycleCount: 0,
      averageFanIn: 1.1,
      averageFanOut: 1.5,
      dependencyDensity: 0.17,
      maxFanOut: 4,
    },
  },

  // ── Elixir ────────────────────────────────────────────────────────────────

  {
    name: 'phoenix-web-app',
    metrics: {
      moduleCount: 14,
      dependencyCount: 28,
      cycleCount: 0,
      averageFanIn: 1.5,
      averageFanOut: 2.0,
      dependencyDensity: 0.15,
      maxFanOut: 7,
    },
  },

  // ── Dart / Flutter ────────────────────────────────────────────────────────

  {
    name: 'flutter-app',
    metrics: {
      moduleCount: 12,
      dependencyCount: 20,
      cycleCount: 0,
      averageFanIn: 1.3,
      averageFanOut: 1.7,
      dependencyDensity: 0.15,
      maxFanOut: 4,
    },
  },

  // ── Scala ─────────────────────────────────────────────────────────────────

  {
    name: 'play-framework-app',
    metrics: {
      moduleCount: 14,
      dependencyCount: 26,
      cycleCount: 0,
      averageFanIn: 1.4,
      averageFanOut: 1.9,
      dependencyDensity: 0.14,
      maxFanOut: 5,
    },
  },

  // ── Swift ─────────────────────────────────────────────────────────────────

  {
    name: 'vapor-api',
    metrics: {
      moduleCount: 10,
      dependencyCount: 16,
      cycleCount: 0,
      averageFanIn: 1.2,
      averageFanOut: 1.6,
      dependencyDensity: 0.18,
      maxFanOut: 4,
    },
  },

  // ── Microservices / distributed ───────────────────────────────────────────

  {
    name: 'microservice-domain',
    metrics: {
      moduleCount: 8,
      dependencyCount: 12,
      cycleCount: 0,
      averageFanIn: 1.1,
      averageFanOut: 1.5,
      dependencyDensity: 0.21,
      maxFanOut: 3,
    },
  },
];
