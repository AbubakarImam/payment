import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import {
  CreatePaymentData,
  IPaymentRepository,
  UpdatePaymentData,
} from '../../domain/interfaces/payment-repository.interface';
import { PaymentEntity } from '../../domain/entities/payment.entity';
import { RefundEntity } from '../../domain/entities/refund.entity';
import { Prisma } from '@prisma/client';

@Injectable()
export class PaymentRepository implements IPaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreatePaymentData): Promise<PaymentEntity> {
    const record = await this.prisma.payment.create({
      data: {
        reference: data.reference,
        email: data.email,
        amount: data.amount,
        currency: data.currency,
        metadata: (data.metadata ?? undefined) as Prisma.InputJsonValue,
        idempotencyKey: data.idempotencyKey,
        callbackUrl: data.callbackUrl,
        ipAddress: data.ipAddress,
        paystackAccessCode: data.paystackAccessCode,
        status: 'INITIALIZED',
      },
    });
    return record as unknown as PaymentEntity;
  }

  async findByReference(reference: string): Promise<PaymentEntity | null> {
    const record = await this.prisma.payment.findUnique({ where: { reference } });
    return record as unknown as PaymentEntity | null;
  }

  async findByIdempotencyKey(key: string): Promise<PaymentEntity | null> {
    const record = await this.prisma.payment.findUnique({ where: { idempotencyKey: key } });
    return record as unknown as PaymentEntity | null;
  }

  async update(reference: string, data: UpdatePaymentData): Promise<PaymentEntity> {
    const record = await this.prisma.payment.update({
      where: { reference },
      data: {
        status: data.status,
        channel: data.channel,
        gatewayResponse: data.gatewayResponse,
        paidAt: data.paidAt,
        paystackAccessCode: data.paystackAccessCode,
      },
    });
    return record as unknown as PaymentEntity;
  }

  async createRefund(data: {
    paymentId: string;
    reference: string;
    amount?: number | null;
    reason?: string | null;
  }): Promise<RefundEntity> {
    const record = await this.prisma.refund.create({
      data: {
        paymentId: data.paymentId,
        reference: data.reference,
        amount: data.amount,
        reason: data.reason,
      },
    });
    return record as unknown as RefundEntity;
  }

  async updateRefund(
    reference: string,
    data: Partial<Pick<RefundEntity, 'status' | 'paystackRefundId'>>,
  ): Promise<RefundEntity> {
    const record = await this.prisma.refund.update({
      where: { reference },
      data,
    });
    return record as unknown as RefundEntity;
  }

  async hasProcessedWebhookEvent(eventId: string): Promise<boolean> {
    const record = await this.prisma.webhookEvent.findUnique({ where: { eventId } });
    return !!record;
  }

  async markWebhookEventProcessed(
    eventId: string,
    eventType: string,
    reference?: string,
  ): Promise<void> {
    await this.prisma.webhookEvent.create({
      data: { eventId, eventType, reference },
    });
  }

  async getIdempotentResponse(key: string): Promise<unknown | null> {
    const record = await this.prisma.idempotencyRecord.findUnique({ where: { key } });
    return record ? record.responseJson : null;
  }

  async saveIdempotentResponse(key: string, response: unknown): Promise<void> {
    await this.prisma.idempotencyRecord.upsert({
      where: { key },
      create: { key, responseJson: response as Prisma.InputJsonValue },
      update: { responseJson: response as Prisma.InputJsonValue },
    });
  }
}
