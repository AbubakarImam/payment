import { Injectable } from '@nestjs/common';
import * as client from 'prom-client';

/**
 * Thin, typed wrapper around prom-client. Nothing outside this file ever
 * touches a raw `Counter`/`Histogram` instance or a label string literal —
 * the same reason you'd wrap `System.Diagnostics.Metrics.Meter` in a typed
 * `IMetricsService` in .NET instead of scattering `meter.CreateCounter(...)`
 * calls through the codebase: one place to get metric names and label sets
 * right, everywhere else just calls a method.
 *
 * Exposed at GET /metrics in Prometheus text exposition format, scraped by
 * a Prometheus server (or anything compatible — Grafana Agent, VictoriaMetrics).
 */
@Injectable()
export class MetricsService {
  readonly registry = new client.Registry();

  private readonly paymentsInitialized: client.Counter;
  private readonly paymentsSuccessful: client.Counter;
  private readonly paymentsFailed: client.Counter;
  private readonly paymentsRefunded: client.Counter;
  private readonly webhookEvents: client.Counter;
  private readonly webhookSignatureFailures: client.Counter;
  private readonly grpcAuthFailures: client.Counter;
  private readonly requestDuration: client.Histogram;

  constructor() {
    client.collectDefaultMetrics({ register: this.registry, prefix: 'payment_service_' });

    this.paymentsInitialized = new client.Counter({
      name: 'payment_service_payments_initialized_total',
      help: 'Total number of payments successfully initialized with Paystack',
      registers: [this.registry],
    });

    this.paymentsSuccessful = new client.Counter({
      name: 'payment_service_payments_successful_total',
      help: 'Total number of payments that reached a SUCCESSFUL state',
      registers: [this.registry],
    });

    this.paymentsFailed = new client.Counter({
      name: 'payment_service_payments_failed_total',
      help: 'Total number of payments that reached a FAILED or ABANDONED state',
      registers: [this.registry],
    });

    this.paymentsRefunded = new client.Counter({
      name: 'payment_service_payments_refunded_total',
      help: 'Total number of successfully processed refunds',
      registers: [this.registry],
    });

    this.webhookEvents = new client.Counter({
      name: 'payment_service_webhook_events_total',
      help: 'Total Paystack webhook events received, by event type',
      labelNames: ['event_type'],
      registers: [this.registry],
    });

    // Security-relevant: a spike here is either an attack (someone probing
    // the webhook endpoint) or a misconfigured secret — worth its own
    // metric rather than being buried in logs, so it can back an alert.
    this.webhookSignatureFailures = new client.Counter({
      name: 'payment_service_webhook_signature_failures_total',
      help: 'Total webhook requests rejected for an invalid HMAC signature',
      registers: [this.registry],
    });

    // Same reasoning: a spike is either a misconfigured internal caller or
    // an unauthorized access attempt against the gRPC surface.
    this.grpcAuthFailures = new client.Counter({
      name: 'payment_service_grpc_auth_failures_total',
      help: 'Total gRPC calls rejected for a missing/invalid shared secret',
      registers: [this.registry],
    });

    this.requestDuration = new client.Histogram({
      name: 'payment_service_request_duration_seconds',
      help: 'Request duration in seconds, by transport/handler/outcome',
      labelNames: ['transport', 'handler', 'outcome'],
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });
  }

  recordPaymentInitialized(): void {
    this.paymentsInitialized.inc();
  }

  recordPaymentSuccessful(): void {
    this.paymentsSuccessful.inc();
  }

  recordPaymentFailed(): void {
    this.paymentsFailed.inc();
  }

  recordPaymentRefunded(): void {
    this.paymentsRefunded.inc();
  }

  recordWebhookEvent(eventType: string): void {
    this.webhookEvents.inc({ event_type: eventType });
  }

  recordWebhookSignatureFailure(): void {
    this.webhookSignatureFailures.inc();
  }

  recordGrpcAuthFailure(): void {
    this.grpcAuthFailures.inc();
  }

  observeRequestDuration(transport: string, handler: string, outcome: 'ok' | 'error', seconds: number): void {
    this.requestDuration.observe({ transport, handler, outcome }, seconds);
  }

  async getMetricsText(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
