import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppConfigModule } from './config/app-config.module';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { PaystackModule } from './infrastructure/paystack/paystack.module';
import { RabbitMqModule } from './infrastructure/rabbitmq/rabbitmq.module';
import { ApplicationModule } from './application/application.module';
import { GrpcModule } from './grpc/grpc.module';
import { WebhookModule } from './webhook/webhook.module';
import { HealthModule } from './health/health.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    AppConfigModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('throttle.ttlMs')!,
            limit: config.get<number>('throttle.limit')!,
          },
        ],
      }),
    }),
    PersistenceModule,
    PaystackModule,
    RabbitMqModule,
    ApplicationModule,
    GrpcModule,
    WebhookModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
