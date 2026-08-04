import { PaymentEventName } from '../../../domain/enums/payment-event.enum';

/**
 * Wire schema for every event published on the `payment.events` exchange.
 * Routing key = `payment.<event>` (lowercase, dot-separated), e.g.
 * `payment.paymentsuccessful` is NOT used — routing keys are explicitly
 * mapped below to keep them stable and human-readable regardless of the
 * enum's casing.
 */
export const EVENT_ROUTING_KEYS: Record<PaymentEventName, string> = {
  [PaymentEventName.PAYMENT_INITIALIZED]: 'payment.initialized',
  [PaymentEventName.PAYMENT_SUCCESSFUL]: 'payment.successful',
  [PaymentEventName.PAYMENT_FAILED]: 'payment.failed',
  [PaymentEventName.PAYMENT_REFUNDED]: 'payment.refunded',
};

export interface BaseEventEnvelope<T> {
  eventId: string;
  eventName: PaymentEventName;
  occurredAt: string;
  version: 1;
  /**
   * Correlation ID of the request/webhook delivery that caused this event,
   * when available — lets a downstream consumer join its own logs back to
   * the request that originated the whole chain. See RequestContextService.
   */
  correlationId?: string;
  data: T;
}

export interface PaymentInitializedPayload {
  reference: string;
  email: string;
  amount: number;
  currency: string;
  status: string;
  occurredAt: string;
}

export interface PaymentSuccessfulPayload {
  reference: string;
  email: string;
  amount: number;
  currency: string;
  channel?: string;
  paidAt?: string | null;
  occurredAt: string;
}

export interface PaymentFailedPayload {
  reference: string;
  email: string;
  amount: number;
  currency: string;
  reason?: string;
  occurredAt: string;
}

export interface PaymentRefundedPayload {
  reference: string;
  refundReference?: string;
  amount: number;
  currency: string;
  reason?: string;
  occurredAt: string;
}
