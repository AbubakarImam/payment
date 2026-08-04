import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

/**
 * Records `payment_service_request_duration_seconds` for every HTTP and
 * gRPC call. Registered as a global APP_INTERCEPTOR (see app.module.ts) —
 * this is the metrics equivalent of ASP.NET Core's request-timing
 * middleware, just implemented once for both transports instead of two
 * separate pipelines.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const transport = context.getType();
    const handler = `${context.getClass().name}.${context.getHandler().name}`;
    const start = process.hrtime.bigint();

    const record = (outcome: 'ok' | 'error') => {
      const elapsedNs = process.hrtime.bigint() - start;
      const seconds = Number(elapsedNs) / 1e9;
      this.metrics.observeRequestDuration(transport, handler, outcome, seconds);
    };

    return next.handle().pipe(
      tap({
        next: () => record('ok'),
        error: () => record('error'),
      }),
    );
  }
}
