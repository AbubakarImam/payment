import { Module } from '@nestjs/common';
import { PaystackService } from './paystack.service';
import { PAYMENT_GATEWAY } from '../../domain/interfaces/payment-gateway.interface';

@Module({
  providers: [
    PaystackService,
    { provide: PAYMENT_GATEWAY, useExisting: PaystackService },
  ],
  exports: [PAYMENT_GATEWAY, PaystackService],
})
export class PaystackModule {}
