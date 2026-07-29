import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentClientModule } from './payment-client/payment-client.module';
import { PaymentEventsListener } from './events/payment-events.listener';
import { DemoController } from './demo.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PaymentClientModule],
  controllers: [DemoController],
  providers: [PaymentEventsListener],
})
export class AppModule {}
