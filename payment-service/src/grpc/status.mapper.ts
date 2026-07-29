import { PaymentStatus } from '../domain/enums/payment-status.enum';

// Mirrors the `PaymentStatus` enum ordinal values in payment.proto.
export const PROTO_STATUS_MAP: Record<PaymentStatus, number> = {
  [PaymentStatus.PENDING]: 1,
  [PaymentStatus.INITIALIZED]: 2,
  [PaymentStatus.SUCCESSFUL]: 3,
  [PaymentStatus.FAILED]: 4,
  [PaymentStatus.ABANDONED]: 5,
  [PaymentStatus.REFUNDED]: 6,
  [PaymentStatus.PARTIALLY_REFUNDED]: 7,
};

export function toProtoStatus(status: PaymentStatus): number {
  return PROTO_STATUS_MAP[status] ?? 0;
}
