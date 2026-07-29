import { Observable } from 'rxjs';
import { Metadata } from '@grpc/grpc-js';

/** Mirrors the PaymentService gRPC contract (see proto/payment.proto). */
export interface PaymentGrpcService {
  initializePayment(
    request: {
      amount: number;
      email: string;
      currency: string;
      metadata?: { fields: Record<string, string> };
      callback_url?: string;
      idempotency_key: string;
      reference?: string;
      channels?: string[];
    },
    metadata?: Metadata,
  ): Observable<{
    success: boolean;
    reference: string;
    authorization_url: string;
    access_code: string;
    status: number;
    message: string;
  }>;

  verifyPayment(
    request: { reference: string },
    metadata?: Metadata,
  ): Observable<{
    success: boolean;
    reference: string;
    status: number;
    amount: number;
    currency: string;
    channel: string;
    gateway_response: string;
    paid_at: string;
    message: string;
  }>;

  getPaymentStatus(
    request: { reference: string },
    metadata?: Metadata,
  ): Observable<{
    success: boolean;
    reference: string;
    status: number;
    amount: number;
    currency: string;
    email: string;
    created_at: string;
    updated_at: string;
    message: string;
  }>;

  refundPayment(
    request: {
      reference: string;
      amount?: number;
      reason?: string;
      idempotency_key: string;
    },
    metadata?: Metadata,
  ): Observable<{
    success: boolean;
    refund_reference: string;
    original_reference: string;
    status: number;
    message: string;
  }>;
}
