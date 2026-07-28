import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';

// Deliberately no PermissionsGuard — a Prometheus scraper is an
// unauthenticated infrastructure client, same convention as every real
// Prometheus target's /metrics endpoint. Network-level access control
// (firewalling this port/path) is the real-world safeguard, same as it
// would be for a genuine production deployment.
@ApiTags('observability')
@Controller()
export class ObservabilityController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain')
  async metricsEndpoint() {
    return this.metrics.getMetricsText();
  }
}
