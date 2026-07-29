import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import { ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';
import { v4 as uuid } from 'uuid';
import { IEventPublisher } from '../../domain/interfaces/event-publisher.interface';
import { PaymentEventName } from '../../domain/enums/payment-event.enum';
import { EVENT_ROUTING_KEYS, BaseEventEnvelope } from './events/payment-events.schema';
import { redact } from '../../common/utils/redact.util';

/**
 * Publishes domain events to a durable topic exchange. Uses
 * amqp-connection-manager for automatic reconnection/backoff so transient
 * RabbitMQ outages don't crash the service, and confirm-channel publishing
 * so we know a message was actually accepted by the broker before we log
 * success.
 */
@Injectable()
export class RabbitMqPublisherService implements IEventPublisher, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqPublisherService.name);
  private connection: amqp.AmqpConnectionManager;
  private channelWrapper: ChannelWrapper;
  private readonly exchange: string;
  private readonly exchangeType: string;

  constructor(private readonly configService: ConfigService) {
    this.exchange = this.configService.get<string>('rabbitmq.exchange')!;
    this.exchangeType = this.configService.get<string>('rabbitmq.exchangeType')!;
  }

  async onModuleInit() {
    const url = this.configService.get<string>('rabbitmq.url')!;

    this.connection = amqp.connect([url], { heartbeatIntervalInSeconds: 10 });
    this.connection.on('connect', () => this.logger.log('Connected to RabbitMQ'));
    this.connection.on('disconnect', (err) =>
      this.logger.warn(`Disconnected from RabbitMQ: ${err?.err?.message ?? 'unknown'}`),
    );

    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: async (channel: ConfirmChannel) => {
        await channel.assertExchange(this.exchange, this.exchangeType, { durable: true });
      },
    });

    await this.channelWrapper.waitForConnect();
    this.logger.log(`Publisher channel ready on exchange "${this.exchange}"`);
  }

  async onModuleDestroy() {
    await this.channelWrapper?.close();
    await this.connection?.close();
  }

  async publish<T extends Record<string, unknown>>(
    eventName: PaymentEventName,
    payload: T,
  ): Promise<void> {
    const routingKey = EVENT_ROUTING_KEYS[eventName];
    const envelope: BaseEventEnvelope<T> = {
      eventId: uuid(),
      eventName,
      occurredAt: new Date().toISOString(),
      version: 1,
      data: payload,
    };

    try {
      await this.channelWrapper.publish(this.exchange, routingKey, envelope, {
        persistent: true,
        contentType: 'application/json',
        messageId: envelope.eventId,
        timestamp: Date.now(),
      });
      this.logger.log(
        `Published event ${eventName} [${envelope.eventId}] -> ${routingKey}: ${JSON.stringify(
          redact(payload),
        )}`,
      );
    } catch (err) {
      this.logger.error(`Failed to publish event ${eventName}: ${(err as Error).message}`);
      throw err;
    }
  }
}
