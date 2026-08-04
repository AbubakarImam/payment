import { Module } from '@nestjs/common';
import { PaymentService } from './services/payment.service';
import { WebhookProcessorService } from './services/webhook-processor.service';
import { PersistenceModule } from '../infrastructure/persistence/persistence.module';
import { PaystackModule } from '../infrastructure/paystack/paystack.module';
import { RabbitMqModule } from '../infrastructure/rabbitmq/rabbitmq.module';

/**
 * Wires the application layer's port dependencies (IPaymentRepository,
 * IPaymentGateway, IEventPublisher) to their concrete adapters by
 * importing the infrastructure modules that provide those DI tokens.
 * PaymentService/WebhookProcessorService only ever import the *interface*
 * from domain/ — this is the one place that connects the interface to a
 * real implementation, same role as `builder.Services.AddScoped<IFoo, Foo>()`
 * in a .NET composition root.
 */
@Module({
  imports: [PersistenceModule, PaystackModule, RabbitMqModule],
  providers: [PaymentService, WebhookProcessorService],
  exports: [PaymentService, WebhookProcessorService],
})
export class ApplicationModule {}
