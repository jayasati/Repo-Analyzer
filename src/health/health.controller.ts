import { Controller, Get } from '@nestjs/common';

/**
 * WHY: Load balancers, Kubernetes liveness probes, and UptimeRobot all
 * need a cheap endpoint to confirm the process is alive. Without it,
 * the only way to tell if the app is up is to attempt a full analysis.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; uptime: number; timestamp: string } {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  ready(): { status: string } {
    // Phase 2 will add Redis + DB readiness checks here
    return { status: 'ready' };
  }
}
