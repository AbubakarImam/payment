import { Controller, UseFilters, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { PaymentService } from '../application/services/payment.service';
import { InitializePaymentDto } from '../application/dto/initialize-payment.dto';
import { VerifyPaymentDto } from '../application/dto/verify-payment.dto';
import { GetPaymentStatusDto } from '../application/dto/get-payment-status.dto';
import { RefundPaymentDto } from '../application/dto/refund-payment.dto';
import { GrpcAuthGuard } from '../common/guards/grpc-auth.guard';
import { GrpcExceptionFilter } from '../common/filters/grpc-exception.filter';
import { toProtoStatus } from './status.mapper';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

interface GrpcMetadataFields {
  fields?: Record<string, string>;
}

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

async function validateDto<T extends object>(cls: new () => T, plain: object): Promise<T> {
  const instance = plainToInstance(cls, plain);
  const errors = await validate(instance as object, { whitelist: true, forbidNonWhitelisted: true });
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
 */
@Controller()
@UseGuards(GrpcAuthGuard)
@UseFilters(GrpcExceptionFilter)
export class PaymentGrpcController {
  constructor(private readonly paymentService: PaymentService) {}

  @GrpcMethod('PaymentService', 'InitializePayment')
  async initializePayment(data: any) {
    const dto = await validateDto(InitializePaymentDto, {
      amount: Number(data.amount),
      email: data.email,
      currency: data.currency,
      metadata: toRecord(data.metadata),
      callbackUrl: data.callback_url || data.callbackUrl,
      idempotencyKey: data.idempotency_key || data.idempotencyKey,
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
  async verifyPayment(data: any) {
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
  async getPaymentStatus(data: any) {
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
  async refundPayment(data: any) {
    const dto = await validateDto(RefundPaymentDto, {
      reference: data.reference,
      amount: data.amount ? Number(data.amount) : undefined,
      reason: data.reason || undefined,
      idempotencyKey: data.idempotency_key || data.idempotencyKey,
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
