import { Controller, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaymentService } from '../application/services/payment.service';
import { InitializePaymentDto } from '../application/dto/initialize-payment.dto';
import { VerifyPaymentDto } from '../application/dto/verify-payment.dto';
import { GetPaymentStatusDto } from '../application/dto/get-payment-status.dto';
import { RefundPaymentDto } from '../application/dto/refund-payment.dto';
import { GrpcAuthGuard } from '../common/guards/grpc-auth.guard';
import { GrpcExceptionFilter } from '../common/filters/grpc-exception.filter';
import { RequestContextInterceptor } from '../common/interceptors/request-context.interceptor';
import { MetricsInterceptor } from '../observability/metrics.interceptor';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { toProtoStatus } from './status.mapper';
import {
  GetPaymentStatusWireRequest,
  GetPaymentStatusWireResponse,
  GrpcMetadataFields,
  InitializePaymentWireRequest,
  InitializePaymentWireResponse,
  RefundPaymentWireRequest,
  RefundPaymentWireResponse,
  VerifyPaymentWireRequest,
  VerifyPaymentWireResponse,
} from './payment.types';

function toRecord(metadata?: GrpcMetadataFields): Record<string, string> | undefined {
  return metadata?.fields;
}

function toGrpcMetadata(record?: Record<string, unknown> | null): GrpcMetadataFields {
  if (!record) return { fields: {} };
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    fields[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return { fields };
}

/**
 * Validates a plain wire object against a DTO class using the same
 * class-validator rules the HTTP side gets for free from `ValidationPipe`.
 * gRPC has no built-in pipe integration for `@GrpcMethod`, so this is the
 * explicit equivalent — the gRPC analogue of manually calling
 * `TryValidateModel` in an ASP.NET Core action instead of relying on
 * automatic model-state validation.
 */
async function validateDto<T extends object>(cls: new () => T, plain: object): Promise<T> {
  const instance = plainToInstance(cls, plain);
  const errors = await validate(instance as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length > 0) {
    const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    throw new RpcException({ code: GrpcStatus.INVALID_ARGUMENT, message: messages.join('; ') });
  }
  return instance;
}

/**
 * gRPC transport adapter. Thin by design — all business logic lives in
 * PaymentService (application layer). This controller's only job is
 * proto <-> DTO translation, auth, and error mapping.
 *
 * Interceptors are bound explicitly here rather than relying on the
 * `APP_INTERCEPTOR` global registration in app.module.ts: in a *hybrid*
 * Nest application (one process serving both HTTP and gRPC, see main.ts),
 * globally-registered interceptors are not reliably invoked for the
 * gRPC side. Guards/filters don't have this problem — `GrpcAuthGuard`
 * and `GrpcExceptionFilter` below are controller-scoped for the same
 * reason of being explicit, not because they needed the workaround.
 * Order matches app.module.ts: correlation ID first, then metrics, then
 * logging (which reads the correlation ID the first one set).
 */
@Controller()
@UseGuards(GrpcAuthGuard)
@UseFilters(GrpcExceptionFilter)
@UseInterceptors(RequestContextInterceptor, MetricsInterceptor, LoggingInterceptor)
export class PaymentGrpcController {
  constructor(private readonly paymentService: PaymentService) {}

  @GrpcMethod('PaymentService', 'InitializePayment')
  async initializePayment(
    data: InitializePaymentWireRequest,
  ): Promise<InitializePaymentWireResponse> {
    const dto = await validateDto(InitializePaymentDto, {
      amount: Number(data.amount),
      email: data.email,
      currency: data.currency,
      metadata: toRecord(data.metadata),
      // @grpc/proto-loader fills unset optional proto3 string fields with
      // "" (the loader's `defaults: true` option), not undefined — without
      // the `|| undefined` here, class-validator's @IsOptional() wouldn't
      // skip @IsUrl() validation for a call that simply omits callback_url.
      callbackUrl: data.callback_url || undefined,
      idempotencyKey: data.idempotency_key,
      reference: data.reference || undefined,
      channels: data.channels?.length ? data.channels : undefined,
    });

    const result = await this.paymentService.initializePayment(dto);

    return {
      success: true,
      reference: result.reference,
      authorization_url: result.authorizationUrl,
      access_code: result.accessCode,
      status: toProtoStatus(result.status),
      message: 'Payment initialized successfully',
    };
  }

  @GrpcMethod('PaymentService', 'VerifyPayment')
  async verifyPayment(data: VerifyPaymentWireRequest): Promise<VerifyPaymentWireResponse> {
    const dto = await validateDto(VerifyPaymentDto, { reference: data.reference });

    const result = await this.paymentService.verifyPayment(dto.reference);

    return {
      success: true,
      reference: result.payment.reference,
      status: toProtoStatus(result.payment.status),
      amount: result.payment.amount,
      currency: result.payment.currency,
      channel: result.channel ?? '',
      gateway_response: result.gatewayResponse ?? '',
      paid_at: result.paidAt ?? '',
      metadata: toGrpcMetadata(result.payment.metadata as Record<string, unknown> | undefined),
      message: 'Payment verified',
    };
  }

  @GrpcMethod('PaymentService', 'GetPaymentStatus')
  async getPaymentStatus(
    data: GetPaymentStatusWireRequest,
  ): Promise<GetPaymentStatusWireResponse> {
    const dto = await validateDto(GetPaymentStatusDto, { reference: data.reference });

    const payment = await this.paymentService.getPaymentStatus(dto.reference);

    return {
      success: true,
      reference: payment.reference,
      status: toProtoStatus(payment.status),
      amount: payment.amount,
      currency: payment.currency,
      email: payment.email,
      created_at: payment.createdAt.toISOString(),
      updated_at: payment.updatedAt.toISOString(),
      message: 'OK',
    };
  }

  @GrpcMethod('PaymentService', 'RefundPayment')
  async refundPayment(data: RefundPaymentWireRequest): Promise<RefundPaymentWireResponse> {
    const dto = await validateDto(RefundPaymentDto, {
      reference: data.reference,
      amount: data.amount ? Number(data.amount) : undefined,
      reason: data.reason || undefined,
      idempotencyKey: data.idempotency_key,
    });

    const result = await this.paymentService.refundPayment(dto);

    return {
      success: true,
      refund_reference: result.refundReference,
      original_reference: result.originalReference,
      status: toProtoStatus(result.status),
      message: 'Refund processed',
    };
  }
}
