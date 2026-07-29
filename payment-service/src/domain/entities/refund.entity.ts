export enum RefundStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

export class RefundEntity {
  id: string;
  paymentId: string;
  reference: string;
  amount?: number | null;
  status: RefundStatus;
  reason?: string | null;
  paystackRefundId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
