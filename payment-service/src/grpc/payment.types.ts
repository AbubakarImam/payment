/**
 * Hand-written TypeScript mirror of `src/proto/payment.proto`.
 *
 * Why this file exists: this project loads the `.proto` at *runtime* via
 * `@grpc/proto-loader` (see main.ts) rather than generating TypeScript at
 * *build time* the way `protoc`/`Grpc.Tools` does for a .NET gRPC service.
 * That keeps the build simple but means nothing catches a typo in a field
 * name for you — these interfaces are what stand in for that compile-time
 * safety net. If the `.proto` contract changes, update this file to match.
 *
 * (For a larger project, swap the runtime loader for the `ts-proto`
 * compiler plugin, which generates exactly this kind of file for you from
 * the `.proto` source — see the "gRPC in this project" section of the
 * system design doc.)
 *
 * `keepCase: true` in the loader options means field names arrive exactly
 * as declared in the `.proto` (snake_case), not camelCased.
 */

export interface GrpcMetadataFields {
  fields?: Record<string, string>;
}

export interface InitializePaymentWireRequest {
  amount: number | string;
  email: string;
  currency: string;
  metadata?: GrpcMetadataFields;
  callback_url?: string;
  idempotency_key: string;
  reference?: string;
  channels?: string[];
}

export interface InitializePaymentWireResponse {
  success: boolean;
  reference: string;
  authorization_url: string;
  access_code: string;
  status: number;
  message: string;
}

export interface VerifyPaymentWireRequest {
  reference: string;
}

export interface VerifyPaymentWireResponse {
  success: boolean;
  reference: string;
  status: number;
  amount: number;
  currency: string;
  channel: string;
  gateway_response: string;
  paid_at: string;
  metadata: GrpcMetadataFields;
  message: string;
}

export interface GetPaymentStatusWireRequest {
  reference: string;
}

export interface GetPaymentStatusWireResponse {
  success: boolean;
  reference: string;
  status: number;
  amount: number;
  currency: string;
  email: string;
  created_at: string;
  updated_at: string;
  message: string;
}

export interface RefundPaymentWireRequest {
  reference: string;
  amount?: number | string;
  reason?: string;
  idempotency_key: string;
}

export interface RefundPaymentWireResponse {
  success: boolean;
  refund_reference: string;
  original_reference: string;
  status: number;
  message: string;
}
