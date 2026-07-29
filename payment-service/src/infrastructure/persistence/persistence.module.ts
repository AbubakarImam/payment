import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { PaymentRepository } from './payment.repository';
import { PAYMENT_REPOSITORY } from '../../domain/interfaces/payment-repository.interface';

@Module({
  imports: [PrismaModule],
  providers: [
    PaymentRepository,
    { provide: PAYMENT_REPOSITORY, useExisting: PaymentRepository },
  ],
  exports: [PAYMENT_REPOSITORY, PaymentRepository],
})
export class PersistenceModule {}
