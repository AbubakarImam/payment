import { Module } from '@nestjs/common';
import { PaymentGrpcController } from './payment.controller';
import { ApplicationModule } from '../application/application.module';

@Module({
  imports: [ApplicationModule],
  controllers: [PaymentGrpcController],
})
export class GrpcModule {}
