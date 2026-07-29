import { PaymentStatus } from '../enums/payment-status.enum';

/**
 * Core domain entity. Deliberately excludes any card/PAN data —
 * Paystack owns card capture; we only ever persist transaction metadata.
 */
export class PaymentEntity {
  id: string;
  reference: string;
  paystackAccessCode?: string | null;
  email: string;
  amount: number; // smallest currency unit
  currency: string;
  status: PaymentStatus;
  channel?: string | null;
  gatewayResponse?: string | null;
  paidAt?: Date | null;
  metadata?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
  callbackUrl?: string | null;
  ipAddress?: string | null;
  createdAt: Date;
  updatedAt: Date;

  static isTerminal(status: PaymentStatus): boolean {
    return [
      PaymentStatus.SUCCESSFUL,
      PaymentStatus.FAILED,
      PaymentStatus.ABANDONED,
      PaymentStatus.REFUNDED,
    ].includes(status);
  }
}
