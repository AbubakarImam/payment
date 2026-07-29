import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { ApplicationModule } from '../application/application.module';
import { RawBodyMiddleware } from '../common/middleware/raw-body.middleware';
import { PaystackSignatureGuard } from './guards/paystack-signature.guard';
import { WebhookIpAllowlistGuard } from './guards/webhook-ip-allowlist.guard';

@Module({
  imports: [ApplicationModule],
  controllers: [WebhookController],
  providers: [PaystackSignatureGuard, WebhookIpAllowlistGuard],
})
export class WebhookModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RawBodyMiddleware)
      .forRoutes({ path: 'webhooks/paystack', method: RequestMethod.POST });
  }
}
