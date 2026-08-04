import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { RequestContextService } from '../context/request-context.service';

const HEADER = 'x-correlation-id';

/**
 * Establishes the correlation ID for the whole HTTP request lifecycle —
 * applied globally so it runs before guards (unlike a Nest interceptor,
 * which only wraps the pipeline from after guards onward, see
 * RequestContextInterceptor). This means a rejected webhook — bad
 * signature, disallowed IP — is still traceable by the same ID a client
 * could echo back when reporting an issue.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[HEADER];
    const correlationId = (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID();

    res.setHeader(HEADER, correlationId);

    this.requestContext.run({ correlationId }, () => next());
  }
}
