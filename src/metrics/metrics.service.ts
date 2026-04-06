import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Counter,
  Histogram,
  register,
  collectDefaultMetrics,
} from 'prom-client';

/**
 * WHY Prometheus metrics:
 * Prometheus + Grafana is the industry standard for time-series metrics.
 * These counters/histograms let you alert on:
 * - High analysis failure rate (PagerDuty)
 * - P99 analysis duration > 60s (capacity planning)
 * - Clone failures (GitHub API health)
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  readonly analysisTotal = new Counter({
    name: 'analysis_requests_total',
    help: 'Total analysis requests',
    labelNames: ['status'],
  });

  readonly analysisDuration = new Histogram({
    name: 'analysis_duration_seconds',
    help: 'Analysis pipeline duration',
    labelNames: ['phase'],
    buckets: [1, 5, 10, 30, 60, 120, 180],
  });

  readonly cloneDuration = new Histogram({
    name: 'clone_duration_seconds',
    help: 'Git clone duration',
    buckets: [1, 5, 10, 30, 60, 120],
  });

  readonly activeJobs = new Counter({
    name: 'active_analysis_jobs',
    help: 'Currently running analysis jobs',
  });

  onModuleInit(): void {
    // Collect Node.js runtime metrics (heap, GC, event loop lag, etc.)
    collectDefaultMetrics({ register });
  }

  /** Returns Prometheus text format for scraping */
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  getContentType(): string {
    return register.contentType;
  }
}
