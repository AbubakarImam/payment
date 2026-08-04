import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { constantTimeEquals } from '../common/utils/crypto.util';

/**
 * Prometheus metrics can leak operational details (request rates, error
 * rates, which handlers exist) that aren't secrets but also aren't meant
 * to be public. In a real deployment this endpoint is normally protected
 * at the network layer instead (a separate internal-only port, a
 * ServiceMonitor scraping from inside the cluster) — this guard is a
 * fallback for the common case of exposing it on the same public port.
 *
 * Fails closed in production if no token is configured; in development a
 * missing token is allowed through (logged), so local scraping doesn't
 * require extra setup.
 */
@Injectable()
export class MetricsAccessGuard implements CanActivate {
  private readonly logger = new Logger(MetricsAccessGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const token = this.configService.get<string>('metrics.accessToken');
    const isProduction = this.configService.get<string>('env') === 'production';

    if (!token) {
      if (isProduction) {
        this.logger.error('METRICS_ACCESS_TOKEN is not configured — denying /metrics in production');
        throw new UnauthorizedException();
      }
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided =
      (request.headers['x-metrics-token'] as string | undefined) ??
      (request.headers.authorization?.startsWith('Bearer ')
        ? request.headers.authorization.slice(7)
        : undefined);

    if (!provided || !constantTimeEquals(provided, token)) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
