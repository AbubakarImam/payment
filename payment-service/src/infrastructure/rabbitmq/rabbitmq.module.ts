import { Module } from '@nestjs/common';
import { RabbitMqPublisherService } from './rabbitmq.service';
import { EVENT_PUBLISHER } from '../../domain/interfaces/event-publisher.interface';

@Module({
  providers: [
    RabbitMqPublisherService,
    { provide: EVENT_PUBLISHER, useExisting: RabbitMqPublisherService },
  ],
  exports: [EVENT_PUBLISHER, RabbitMqPublisherService],
})
export class RabbitMqModule {}
