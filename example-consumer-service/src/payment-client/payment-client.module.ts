import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';
import { PaymentClientService } from './payment-client.service';

export const PAYMENT_PACKAGE_CLIENT = 'PAYMENT_PACKAGE_CLIENT';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: PAYMENT_PACKAGE_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'payment',
            protoPath: path.join(__dirname, '../proto/payment.proto'),
            url: config.get<string>('PAYMENT_SERVICE_GRPC_URL') ?? 'localhost:5000',
            loader: { keepCase: true, longs: String, enums: Number, defaults: true, oneofs: true },
          },
        }),
      },
    ]),
  ],
  providers: [PaymentClientService],
  exports: [PaymentClientService],
})
export class PaymentClientModule {}
