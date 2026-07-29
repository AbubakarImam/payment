import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Metadata } from '@grpc/grpc-js';
import { PAYMENT_PACKAGE_CLIENT } from './payment-client.module';
import { PaymentGrpcService } from './payment-client.interface';

/**
 * Example of how another internal microservice (e.g. "orders-service")
 * calls the payment-service over gRPC instead of talking to Paystack
 * directly. Note the shared-secret metadata — payment-service's
 * GrpcAuthGuard rejects calls without it.
 */
@Injectable()
export class PaymentClientService implements OnModuleInit {
  private paymentService: PaymentGrpcService;

  constructor(
    @Inject(PAYMENT_PACKAGE_CLIENT) private readonly client: ClientGrpc,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.paymentService = this.client.getService<PaymentGrpcService>('PaymentService');
  }

  private authMetadata(): Metadata {
    const metadata = new Metadata();
    const sharedSecret = this.configService.get<string>('PAYMENT_SERVICE_GRPC_SECRET') ?? '';
    metadata.set('authorization', `Bearer ${sharedSecret}`);
    return metadata;
  }

  async initializePayment(params: {
    amount: number;
    email: string;
    currency: string;
    idempotencyKey: string;
    callbackUrl?: string;
    metadata?: Record<string, string>;
  }) {
    return firstValueFrom(
      this.paymentService.initializePayment(
        {
          amount: params.amount,
          email: params.email,
          currency: params.currency,
          idempotency_key: params.idempotencyKey,
          callback_url: params.callbackUrl,
          metadata: { fields: params.metadata ?? {} },
        },
        this.authMetadata(),
      ),
    );
  }

  async verifyPayment(reference: string) {
    return firstValueFrom(
      this.paymentService.verifyPayment({ reference }, this.authMetadata()),
    );
  }

  async getPaymentStatus(reference: string) {
    return firstValueFrom(
      this.paymentService.getPaymentStatus({ reference }, this.authMetadata()),
    );
  }

  async refundPayment(params: { reference: string; amount?: number; reason?: string; idempotencyKey: string }) {
    return firstValueFrom(
      this.paymentService.refundPayment(
        {
          reference: params.reference,
          amount: params.amount,
          reason: params.reason,
          idempotency_key: params.idempotencyKey,
        },
        this.authMetadata(),
      ),
    );
  }
}
