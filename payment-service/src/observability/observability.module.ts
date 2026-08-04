import { Global, Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsAccessGuard } from './metrics-access.guard';
import { MetricsInterceptor } from './metrics.interceptor';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, MetricsAccessGuard, MetricsInterceptor],
  exports: [MetricsService],
})
export class ObservabilityModule {}
