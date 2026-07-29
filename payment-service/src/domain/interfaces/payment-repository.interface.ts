import { PaymentEntity } from '../entities/payment.entity';
import { RefundEntity } from '../entities/refund.entity';

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');

export interface CreatePaymentData {
  reference: string;
  email: string;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
  callbackUrl?: string | null;
  ipAddress?: string | null;
  paystackAccessCode?: string | null;
}

export interface UpdatePaymentData {
  status?: PaymentEntity['status'];
  channel?: string | null;
  gatewayResponse?: string | null;
  paidAt?: Date | null;
  paystackAccessCode?: string | null;
}

export interface IPaymentRepository {
  create(data: CreatePaymentData): Promise<PaymentEntity>;
  findByReference(reference: string): Promise<PaymentEntity | null>;
  findByIdempotencyKey(key: string): Promise<PaymentEntity | null>;
  update(reference: string, data: UpdatePaymentData): Promise<PaymentEntity>;

  createRefund(data: {
    paymentId: string;
    reference: string;
    amount?: number | null;
    reason?: string | null;
  }): Promise<RefundEntity>;
  updateRefund(
    reference: string,
    data: Partial<Pick<RefundEntity, 'status' | 'paystackRefundId'>>,
  ): Promise<RefundEntity>;

  hasProcessedWebhookEvent(eventId: string): Promise<boolean>;
  markWebhookEventProcessed(eventId: string, eventType: string, reference?: string): Promise<void>;

  getIdempotentResponse(key: string): Promise<unknown | null>;
  saveIdempotentResponse(key: string, response: unknown): Promise<void>;
}
