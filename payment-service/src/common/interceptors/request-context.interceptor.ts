import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { RequestContextService } from '../context/request-context.service';

const HEADER = 'x-correlation-id';

/**
 * Establishes the correlation ID for gRPC calls.
 *
 * HTTP requests already get one from `CorrelationIdMiddleware`, which runs
 * ahead of guards. gRPC has no equivalent "runs before guards" extension
 * point in Nest's microservices package, so `GrpcAuthGuard`'s own
 * rejection logs won't carry a correlation ID — everything from the
 * application service downward will, which covers the flows that matter
 * (a call that got past auth).
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(private readonly requestContext: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'rpc') {
      // HTTP: context was already established by CorrelationIdMiddleware.
      return next.handle();
    }

    const metadata = context.switchToRpc().getContext();
    const incoming: string[] | undefined = metadata?.get?.(HEADER);
    const correlationId = incoming?.[0] || randomUUID();

    return new Observable((subscriber) => {
      this.requestContext.run({ correlationId }, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
