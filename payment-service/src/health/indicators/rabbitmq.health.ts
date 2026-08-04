import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { RabbitMqPublisherService } from '../../infrastructure/rabbitmq/rabbitmq.service';

@Injectable()
export class RabbitMqHealthIndicator extends HealthIndicator {
  constructor(private readonly rabbitMq: RabbitMqPublisherService) {
    super();
  }

  isHealthy(key: string): HealthIndicatorResult {
    const connected = this.rabbitMq.isConnected();
    if (!connected) {
      throw new HealthCheckError(
        'RabbitMQ check failed',
        this.getStatus(key, false, { message: 'not connected' }),
      );
    }
    return this.getStatus(key, true);
  }
}
