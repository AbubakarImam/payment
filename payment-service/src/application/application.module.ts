import { Module } from '@nestjs/common';
import { PaymentService } from './services/payment.service';
import { WebhookProcessorService } from './services/webhook-processor.service';

@Module({
  providers: [PaymentService, WebhookProcessorService],
  exports: [PaymentService, WebhookProcessorService],
})
export class ApplicationModule {}
