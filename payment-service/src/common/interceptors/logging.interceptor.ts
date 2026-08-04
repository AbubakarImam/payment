import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { redact } from '../utils/redact.util';
import { RequestContextService } from '../context/request-context.service';

/**
 * Logs request/response metadata for both HTTP and gRPC contexts with
 * secrets/PII redacted. Never logs full request bodies verbatim — only
 * a redacted summary — so accidental logging can't leak the Paystack
 * secret key, webhook signatures, or customer payment details.
 *
 * Must be registered (in app.module.ts) *after* RequestContextInterceptor
 * so the correlation ID it reads is already set for this call.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('RequestLog');

  constructor(private readonly requestContext: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const type = context.getType();
    const handler = `${context.getClass().name}.${context.getHandler().name}`;
    const start = Date.now();
    const correlationId = this.requestContext.getCorrelationId() ?? 'unknown';

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            `[${correlationId}] [${type}] ${handler} OK (${Date.now() - start}ms)`,
          );
        },
        error: (err) => {
          this.logger.warn(
            `[${correlationId}] [${type}] ${handler} FAILED (${Date.now() - start}ms): ${JSON.stringify(
              redact({ message: (err as Error)?.message }),
            )}`,
          );
        },
      }),
    );
  }
}
