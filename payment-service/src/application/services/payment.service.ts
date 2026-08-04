import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IPaymentRepository,
  PAYMENT_REPOSITORY,
} from '../../domain/interfaces/payment-repository.interface';
import {
  IPaymentGateway,
  InitializeTransactionResult,
  PAYMENT_GATEWAY,
  RefundTransactionResult,
  VerifyTransactionResult,
} from '../../domain/interfaces/payment-gateway.interface';
import {
  EVENT_PUBLISHER,
  IEventPublisher,
} from '../../domain/interfaces/event-publisher.interface';
import { PaymentEventName } from '../../domain/enums/payment-event.enum';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import { PaymentEntity } from '../../domain/entities/payment.entity';
import { RefundStatus } from '../../domain/entities/refund.entity';
import { InitializePaymentDto } from '../dto/initialize-payment.dto';
import { RefundPaymentDto } from '../dto/refund-payment.dto';
import { generatePaymentReference, generateRefundReference } from '../../common/utils/reference.util';
import {
  DuplicatePaymentException,
  PaymentGatewayException,
  PaymentNotFoundException,
} from '../exceptions/payment.exceptions';
import { redact } from '../../common/utils/redact.util';
import { MetricsService } from '../../observability/metrics.service';
import { RequestContextService } from '../../common/context/request-context.service';

export interface InitializePaymentResult {
  reference: string;
  authorizationUrl: string;
  accessCode: string;
  status: PaymentStatus;
}

export interface RefundPaymentResult {
  refundReference: string;
  originalReference: string;
  status: PaymentStatus;
}

/**
 * Application-layer orchestrator (hexagonal "core"). Depends only on
 * ports (repository, gateway, event publisher) — never on Nest transport
 * concerns, Prisma, or the Paystack SDK directly. This is what both the
 * gRPC controller and the webhook controller call into.
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly paymentRepository: IPaymentRepository,
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: IPaymentGateway,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
    private readonly metrics: MetricsService,
    private readonly requestContext: RequestContextService,
  ) {}

  async initializePayment(
    dto: InitializePaymentDto,
    ipAddress?: string,
  ): Promise<InitializePaymentResult> {
    const existing = await this.paymentRepository.findByIdempotencyKey(dto.idempotencyKey);
    if (existing) {
      this.logger.log(`Idempotent replay for key ${dto.idempotencyKey.slice(0, 8)}...`);
      return {
        reference: existing.reference,
        authorizationUrl: '',
        accessCode: existing.paystackAccessCode ?? '',
        status: existing.status,
      };
    }

    const reference = dto.reference ?? generatePaymentReference();
    const alreadyExists = await this.paymentRepository.findByReference(reference);
    if (alreadyExists) {
      throw new DuplicatePaymentException(reference);
    }

    let gatewayResult: InitializeTransactionResult;
    try {
      gatewayResult = await this.paymentGateway.initializeTransaction({
        amount: dto.amount,
        email: dto.email,
        currency: dto.currency,
        reference,
        callbackUrl: dto.callbackUrl,
        metadata: dto.metadata,
        channels: dto.channels,
      });
    } catch (err) {
      this.logger.error(
        `Paystack initialize failed for reference=${reference}: ${(err as Error).message}`,
      );
      throw new PaymentGatewayException('Failed to initialize transaction with Paystack', err);
    }

    const payment = await this.paymentRepository.create({
      reference,
      email: dto.email,
      amount: dto.amount,
      currency: dto.currency,
      metadata: dto.metadata ?? null,
      idempotencyKey: dto.idempotencyKey,
      callbackUrl: dto.callbackUrl ?? null,
      ipAddress: ipAddress ?? null,
      paystackAccessCode: gatewayResult.accessCode,
    });

    await this.paymentRepository.saveIdempotentResponse(dto.idempotencyKey, {
      reference: payment.reference,
      accessCode: gatewayResult.accessCode,
      status: payment.status,
    });

    await this.eventPublisher.publish(PaymentEventName.PAYMENT_INITIALIZED, {
      reference: payment.reference,
      email: payment.email,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      occurredAt: new Date().toISOString(),
    });

    this.metrics.recordPaymentInitialized();
    this.logger.log(
      `[${this.requestContext.getCorrelationId() ?? 'unknown'}] Payment initialized: ${JSON.stringify(
        redact({ reference: payment.reference }),
      )}`,
    );

    return {
      reference: payment.reference,
      authorizationUrl: gatewayResult.authorizationUrl,
      accessCode: gatewayResult.accessCode,
      status: payment.status,
    };
  }

  async verifyPayment(reference: string): Promise<{
    payment: PaymentEntity;
    channel: string;
    gatewayResponse: string;
    paidAt: string | null;
  }> {
    const local = await this.paymentRepository.findByReference(reference);
    if (!local) {
      throw new PaymentNotFoundException(reference);
    }

    let verification: VerifyTransactionResult;
    try {
      verification = await this.paymentGateway.verifyTransaction(reference);
    } catch (err) {
      this.logger.error(`Paystack verify failed for reference=${reference}: ${(err as Error).message}`);
      throw new PaymentGatewayException('Failed to verify transaction with Paystack', err);
    }

    const newStatus = this.mapGatewayStatus(verification.status);
    const wasAlreadyTerminal = PaymentEntity.isTerminal(local.status);

    const updated = await this.paymentRepository.update(reference, {
      status: newStatus,
      channel: verification.channel,
      gatewayResponse: verification.gatewayResponse,
      paidAt: verification.paidAt ? new Date(verification.paidAt) : null,
    });

    // Only emit success/failure events on the transition into a terminal
    // state to avoid duplicate downstream event processing on re-verification.
    if (!wasAlreadyTerminal) {
      if (newStatus === PaymentStatus.SUCCESSFUL) {
        await this.eventPublisher.publish(PaymentEventName.PAYMENT_SUCCESSFUL, {
          reference: updated.reference,
          email: updated.email,
          amount: updated.amount,
          currency: updated.currency,
          channel: verification.channel,
          paidAt: verification.paidAt,
          occurredAt: new Date().toISOString(),
        });
        this.metrics.recordPaymentSuccessful();
      } else if (newStatus === PaymentStatus.FAILED || newStatus === PaymentStatus.ABANDONED) {
        await this.eventPublisher.publish(PaymentEventName.PAYMENT_FAILED, {
          reference: updated.reference,
          email: updated.email,
          amount: updated.amount,
          currency: updated.currency,
          reason: verification.gatewayResponse,
          occurredAt: new Date().toISOString(),
        });
        this.metrics.recordPaymentFailed();
      }
    }

    return {
      payment: updated,
      channel: verification.channel,
      gatewayResponse: verification.gatewayResponse,
      paidAt: verification.paidAt,
    };
  }

  async getPaymentStatus(reference: string): Promise<PaymentEntity> {
    const payment = await this.paymentRepository.findByReference(reference);
    if (!payment) {
      throw new PaymentNotFoundException(reference);
    }
    return payment;
  }

  async refundPayment(dto: RefundPaymentDto): Promise<RefundPaymentResult> {
    const payment = await this.paymentRepository.findByReference(dto.reference);
    if (!payment) {
      throw new PaymentNotFoundException(dto.reference);
    }
    if (payment.status !== PaymentStatus.SUCCESSFUL && payment.status !== PaymentStatus.PARTIALLY_REFUNDED) {
      throw new PaymentGatewayException(
        `Cannot refund a payment in status ${payment.status}`,
      );
    }

    const existingIdempotent = await this.paymentRepository.getIdempotentResponse(
      dto.idempotencyKey,
    );
    if (existingIdempotent) {
      return existingIdempotent as RefundPaymentResult;
    }

    const refundReference = generateRefundReference();
    await this.paymentRepository.createRefund({
      paymentId: payment.id,
      reference: refundReference,
      amount: dto.amount ?? null,
      reason: dto.reason ?? null,
    });

    let gatewayResult: RefundTransactionResult;
    try {
      gatewayResult = await this.paymentGateway.refundTransaction({
        reference: dto.reference,
        amount: dto.amount,
        reason: dto.reason,
      });
    } catch (err) {
      await this.paymentRepository.updateRefund(refundReference, { status: RefundStatus.FAILED });
      this.logger.error(`Paystack refund failed for reference=${dto.reference}: ${(err as Error).message}`);
      throw new PaymentGatewayException('Failed to process refund with Paystack', err);
    }

    await this.paymentRepository.updateRefund(refundReference, {
      status: RefundStatus.PROCESSED,
      paystackRefundId: gatewayResult.paystackRefundId,
    });

    const newStatus = dto.amount && dto.amount < payment.amount
      ? PaymentStatus.PARTIALLY_REFUNDED
      : PaymentStatus.REFUNDED;

    await this.paymentRepository.update(dto.reference, { status: newStatus });

    await this.eventPublisher.publish(PaymentEventName.PAYMENT_REFUNDED, {
      reference: payment.reference,
      refundReference,
      amount: dto.amount ?? payment.amount,
      currency: payment.currency,
      reason: dto.reason,
      occurredAt: new Date().toISOString(),
    });
    this.metrics.recordPaymentRefunded();

    const result: RefundPaymentResult = {
      refundReference,
      originalReference: payment.reference,
      status: newStatus,
    };

    await this.paymentRepository.saveIdempotentResponse(dto.idempotencyKey, result);

    return result;
  }

  private mapGatewayStatus(status: string): PaymentStatus {
    switch (status) {
      case 'success':
        return PaymentStatus.SUCCESSFUL;
      case 'failed':
        return PaymentStatus.FAILED;
      case 'abandoned':
        return PaymentStatus.ABANDONED;
      default:
        return PaymentStatus.PENDING;
    }
  }
}
