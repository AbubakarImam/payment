import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { RabbitMqHealthIndicator } from './indicators/rabbitmq.health';
import { PersistenceModule } from '../infrastructure/persistence/persistence.module';
import { RabbitMqModule } from '../infrastructure/rabbitmq/rabbitmq.module';

@Module({
  imports: [TerminusModule, PersistenceModule, RabbitMqModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator, RabbitMqHealthIndicator],
})
export class HealthModule {}
