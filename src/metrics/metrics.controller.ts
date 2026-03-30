import { Controller, Get, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';

/**
 * Exposes /metrics for Prometheus scraping.
 * In production, firewall this endpoint so only your Prometheus server
 * can reach it (not public internet).
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async scrape(@Res() res: Response): Promise<void> {
    const body = await this.metrics.getMetrics();
    res.setHeader('Content-Type', this.metrics.getContentType());
    res.send(body);
  }
}