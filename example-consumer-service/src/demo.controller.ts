import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PaymentClientService } from './payment-client/payment-client.service';
import { randomUUID } from 'crypto';

/**
 * Minimal demo endpoints exercising the gRPC client — for illustration
 * only. A real consumer service would call PaymentClientService from
 * its own domain logic (e.g. an OrdersService), not from a throwaway
 * controller like this one.
 */
@Controller('demo')
export class DemoController {
  constructor(private readonly paymentClient: PaymentClientService) {}

  @Post('checkout')
  async checkout(@Body() body: { email: string; amountKobo: number }) {
    return this.paymentClient.initializePayment({
      amount: body.amountKobo,
      email: body.email,
      currency: 'NGN',
      idempotencyKey: randomUUID(),
      callbackUrl: 'https://example.com/checkout/callback',
      metadata: { orderId: 'order_123' },
    });
  }

  @Get('status')
  async status(@Query('reference') reference: string) {
    return this.paymentClient.getPaymentStatus(reference);
  }
}
