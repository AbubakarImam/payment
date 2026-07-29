import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './configuration';
import { validationSchema } from './validation.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        abortEarly: false,
      },
      // .env is only read in non-production; in production, real env vars
      // (injected by the container orchestrator / secrets manager) are used.
      envFilePath: process.env.NODE_ENV === 'production' ? undefined : '.env',
    }),
  ],
})
export class AppConfigModule {}
