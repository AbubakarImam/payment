export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface InitializeTransactionParams {
  amount: number;
  email: string;
  currency: string;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
  channels?: string[];
}

export interface InitializeTransactionResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface VerifyTransactionResult {
  status: 'success' | 'failed' | 'abandoned' | 'pending';
  reference: string;
  amount: number;
  currency: string;
  channel: string;
  gatewayResponse: string;
  paidAt: string | null;
  metadata: Record<string, unknown> | null;
}

export interface RefundTransactionParams {
  reference: string;
  amount?: number;
  reason?: string;
}

export interface RefundTransactionResult {
  status: string;
  paystackRefundId: string;
}

/**
 * Outbound port for the payment gateway. The application layer depends only
 * on this interface, not on the Paystack SDK/HTTP client directly — keeps
 * the core swappable (e.g. to add another PSP) and easily testable.
 */
export interface IPaymentGateway {
  initializeTransaction(
    params: InitializeTransactionParams,
  ): Promise<InitializeTransactionResult>;
  verifyTransaction(reference: string): Promise<VerifyTransactionResult>;
  refundTransaction(params: RefundTransactionParams): Promise<RefundTransactionResult>;
}
