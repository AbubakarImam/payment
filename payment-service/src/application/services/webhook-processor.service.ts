import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IPaymentRepository,
  PAYMENT_REPOSITORY,
} from '../../domain/interfaces/payment-repository.interface';
import {
  EVENT_PUBLISHER,
  IEventPublisher,
} from '../../domain/interfaces/event-publisher.interface';
import { PaymentEventName } from '../../domain/enums/payment-event.enum';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import { hashWebhookPayload } from '../../common/utils/crypto.util';
import { MetricsService } from '../../observability/metrics.service';

export interface PaystackWebhookPayload {
  event: string;
  data: {
    reference: string;
    amount: number;
    currency: string;
    status: string;
    channel?: string;
    gateway_response?: string;
    paid_at?: string;
    customer?: { email?: string };
    metadata?: Record<string, unknown>;
  };
}

/**
 * Processes verified Paystack webhook events. Signature verification and
 * transport concerns live in the webhook controller/guard — by the time
 * a payload reaches here it is trusted to have originated from Paystack.
 */
@Injectable()
export class WebhookProcessorService {
  private readonly logger = new Logger(WebhookProcessorService.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly paymentRepository: IPaymentRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
    private readonly metrics: MetricsService,
  ) {}

  async process(rawBody: Buffer, payload: PaystackWebhookPayload): Promise<void> {
    const eventId = hashWebhookPayload(rawBody);
    this.metrics.recordWebhookEvent(payload.event);

    const alreadyProcessed = await this.paymentRepository.hasProcessedWebhookEvent(eventId);
    if (alreadyProcessed) {
      this.logger.log(`Duplicate webhook event ignored (event=${payload.event})`);
      return;
    }

    switch (payload.event) {
      case 'charge.success':
      case 'transaction.success':
        await this.handleSuccess(payload);
        break;
      case 'charge.failed':
      case 'transaction.failed':
        await this.handleFailure(payload);
        break;
      case 'refund.processed':
        await this.handleRefund(payload);
        break;
      default:
        this.logger.log(`Unhandled webhook event type: ${payload.event}`);
    }

    await this.paymentRepository.markWebhookEventProcessed(
      eventId,
      payload.event,
      payload.data?.reference,
    );
  }

  private async handleSuccess(payload: PaystackWebhookPayload): Promise<void> {
    const { reference } = payload.data;
    const payment = await this.paymentRepository.findByReference(reference);
    if (!payment) {
      this.logger.warn(`Webhook charge.success for unknown reference=${reference}`);
      return;
    }

    const updated = await this.paymentRepository.update(reference, {
      status: PaymentStatus.SUCCESSFUL,
      channel: payload.data.channel ?? null,
      gatewayResponse: payload.data.gateway_response ?? null,
      paidAt: payload.data.paid_at ? new Date(payload.data.paid_at) : new Date(),
    });

    await this.eventPublisher.publish(PaymentEventName.PAYMENT_SUCCESSFUL, {
      reference: updated.reference,
      email: updated.email,
      amount: updated.amount,
      currency: updated.currency,
      channel: payload.data.channel,
      paidAt: payload.data.paid_at,
      occurredAt: new Date().toISOString(),
    });
    this.metrics.recordPaymentSuccessful();
  }

  private async handleFailure(payload: PaystackWebhookPayload): Promise<void> {
    const { reference } = payload.data;
    const payment = await this.paymentRepository.findByReference(reference);
    if (!payment) {
      this.logger.warn(`Webhook charge.failed for unknown reference=${reference}`);
      return;
    }

    const updated = await this.paymentRepository.update(reference, {
      status: PaymentStatus.FAILED,
      gatewayResponse: payload.data.gateway_response ?? null,
    });

    await this.eventPublisher.publish(PaymentEventName.PAYMENT_FAILED, {
      reference: updated.reference,
      email: updated.email,
      amount: updated.amount,
      currency: updated.currency,
      reason: payload.data.gateway_response,
      occurredAt: new Date().toISOString(),
    });
    this.metrics.recordPaymentFailed();
  }

  private async handleRefund(payload: PaystackWebhookPayload): Promise<void> {
    const { reference } = payload.data;
    const payment = await this.paymentRepository.findByReference(reference);
    if (!payment) {
      this.logger.warn(`Webhook refund.processed for unknown reference=${reference}`);
      return;
    }

    const updated = await this.paymentRepository.update(reference, {
      status: PaymentStatus.REFUNDED,
    });

    await this.eventPublisher.publish(PaymentEventName.PAYMENT_REFUNDED, {
      reference: updated.reference,
      amount: payload.data.amount,
      currency: updated.currency,
      occurredAt: new Date().toISOString(),
    });
    this.metrics.recordPaymentRefunded();
  }
}
