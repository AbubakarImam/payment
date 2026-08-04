import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextStore {
  correlationId: string;
}

/**
 * Ambient per-request context, the Node equivalent of ASP.NET Core's
 * `HttpContext.TraceIdentifier` (or a custom `IHttpContextAccessor`).
 *
 * Node has no built-in notion of "the current request" the way .NET's
 * `AsyncLocalStorage`-backed `HttpContext` does — an object doesn't
 * automatically follow a call through every `await`. `AsyncLocalStorage`
 * is the primitive that provides that: whatever runs inside `run()`
 * (including everything it `await`s, however deep) can read the same
 * store via `get()`, without the value being threaded through every
 * function signature in between.
 *
 * Populated once per request/RPC by `RequestContextInterceptor` /
 * `CorrelationIdMiddleware`; read anywhere downstream (services,
 * repositories, the RabbitMQ publisher) that wants to tag a log line or
 * an outgoing event with the correlation ID of the request that caused it.
 */
@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextStore>();

  run<T>(store: RequestContextStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  getCorrelationId(): string | undefined {
    return this.storage.getStore()?.correlationId;
  }
}
