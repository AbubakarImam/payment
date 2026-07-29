import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import { ChannelWrapper } from 'amqp-connection-manager';
import { ConsumeMessage } from 'amqplib';

interface PaymentEventEnvelope<T = Record<string, unknown>> {
  eventId: string;
  eventName: string;
  occurredAt: string;
  version: number;
  data: T;
}

/**
 * Example RabbitMQ consumer showing how a downstream service (e.g.
 * "orders-service") reacts to payment-service's domain events without
 * any direct coupling to payment-service or Paystack.
 *
 * Binds a dedicated, durable queue to the shared `payment.events` topic
 * exchange with routing key `payment.*` so it receives every payment
 * event type. In a real service you'd typically bind only to the
 * specific routing keys you care about (e.g. `payment.successful`).
 */
@Injectable()
export class PaymentEventsListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentEventsListener.name);
  private connection: amqp.AmqpConnectionManager;
  private channelWrapper: ChannelWrapper;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const url = this.configService.get<string>('RABBITMQ_URL') ?? 'amqp://guest:guest@localhost:5672';
    const exchange = this.configService.get<string>('RABBITMQ_EXCHANGE') ?? 'payment.events';
    const queueName = 'orders-service.payment-events';

    this.connection = amqp.connect([url]);
    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: async (channel: any) => {
        await channel.assertExchange(exchange, 'topic', { durable: true });
        await channel.assertQueue(queueName, { durable: true });
        await channel.bindQueue(queueName, exchange, 'payment.*');
        await channel.prefetch(10);
        await channel.consume(queueName, (msg: ConsumeMessage | null) =>
          this.handleMessage(msg, channel),
        );
      },
    });

    await this.channelWrapper.waitForConnect();
    this.logger.log(`Subscribed to "${exchange}" (queue=${queueName}, routingKey=payment.*)`);
  }

  async onModuleDestroy() {
    await this.channelWrapper?.close();
    await this.connection?.close();
  }

  private handleMessage(msg: ConsumeMessage | null, channel: any) {
    if (!msg) return;

    try {
      const envelope: PaymentEventEnvelope = JSON.parse(msg.content.toString('utf8'));
      this.logger.log(`Received ${envelope.eventName} [${envelope.eventId}] routingKey=${msg.fields.routingKey}`);

      switch (envelope.eventName) {
        case 'PaymentSuccessful':
          this.onPaymentSuccessful(envelope);
          break;
        case 'PaymentFailed':
          this.onPaymentFailed(envelope);
          break;
        case 'PaymentInitialized':
        case 'PaymentRefunded':
          // Handle as needed by this service's domain.
          break;
        default:
          this.logger.warn(`Unhandled event type: ${envelope.eventName}`);
      }

      channel.ack(msg);
    } catch (err) {
      this.logger.error(`Failed to process message, nacking without requeue: ${(err as Error).message}`);
      // requeue=false avoids poison-message loops; route to a dead-letter
      // exchange in production for later inspection.
      channel.nack(msg, false, false);
    }
  }

  private onPaymentSuccessful(envelope: PaymentEventEnvelope) {
    // e.g. mark the related order as paid, trigger fulfillment.
    this.logger.log(`Order fulfillment triggered for payment reference=${envelope.data.reference}`);
  }

  private onPaymentFailed(envelope: PaymentEventEnvelope) {
    // e.g. notify the customer, release reserved inventory.
    this.logger.log(`Handling failed payment for reference=${envelope.data.reference}`);
  }
}
