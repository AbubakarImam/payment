import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { Public } from '../common/decorators/public.decorator';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { RabbitMqHealthIndicator } from './indicators/rabbitmq.health';

/**
 * Two distinct checks, matching the two questions a container
 * orchestrator asks (Kubernetes' livenessProbe vs readinessProbe; the
 * same split you'd configure via ASP.NET Core's
 * `MapHealthChecks(..., new() { Predicate = ... })` with tagged checks):
 *
 * - liveness (`/health`): is the process itself alive and able to
 *   respond? No dependency checks — if this fails, the orchestrator
 *   should restart the container. Kept dependency-free on purpose so a
 *   flaky database doesn't trigger a pointless restart loop.
 * - readiness (`/health/ready`): can this instance actually serve
 *   traffic right now? Checks Postgres and RabbitMQ — if this fails,
 *   the orchestrator should stop routing traffic here but does not need
 *   to restart the process.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly rabbitMqHealth: RabbitMqHealthIndicator,
  ) {}

  @Public()
  @Get()
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.rabbitMqHealth.isHealthy('rabbitmq'),
    ]);
  }
}
