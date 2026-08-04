import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppConfigModule } from './config/app-config.module';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { PaystackModule } from './infrastructure/paystack/paystack.module';
import { RabbitMqModule } from './infrastructure/rabbitmq/rabbitmq.module';
import { ApplicationModule } from './application/application.module';
import { GrpcModule } from './grpc/grpc.module';
import { WebhookModule } from './webhook/webhook.module';
import { HealthModule } from './health/health.module';
import { ObservabilityModule } from './observability/observability.module';
import { RequestContextModule } from './common/context/request-context.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { MetricsInterceptor } from './observability/metrics.interceptor';

@Module({
  imports: [
    AppConfigModule,
    RequestContextModule,
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
    ObservabilityModule,
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
    // Order matters: each of these wraps everything listed after it, so
    // the correlation ID must be established first, metrics/timing second,
    // and human-readable request logging last (it wants the final outcome).
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // HTTP only (gRPC has no middleware extension point in Nest — its
    // correlation ID comes from RequestContextInterceptor instead). Runs
    // ahead of every guard, so even a rejected webhook is traceable.
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
