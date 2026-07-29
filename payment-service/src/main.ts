import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import * as fs from 'fs';
import * as path from 'path';
import { ServerCredentials } from '@grpc/grpc-js';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  const isProduction = config.get<string>('env') === 'production';

  // ---- Security headers ----
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false,
    }),
  );

  // ---- CORS ----
  const allowedOrigins = config.get<string[]>('cors.allowedOrigins') ?? [];
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: ['GET', 'POST'],
    credentials: false,
  });

  // Required for WebhookIpAllowlistGuard / rate limiting to see the real
  // client IP when running behind a load balancer / reverse proxy.
  app.set('trust proxy', 1);

  // ---- Global validation (defense in depth alongside gRPC-level validation) ----
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: isProduction,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  // ---- gRPC microservice (hybrid app) ----
  const grpcUrl = config.get<string>('grpc.url')!;
  const grpcPackage = config.get<string>('grpc.package')!;
  const tlsEnabled = config.get<boolean>('grpc.tls.enabled');

  let credentials: ServerCredentials;
  if (tlsEnabled) {
    const certPath = config.get<string>('grpc.tls.certPath')!;
    const keyPath = config.get<string>('grpc.tls.keyPath')!;
    const caPath = config.get<string>('grpc.tls.caPath');

    const cert = fs.readFileSync(certPath);
    const key = fs.readFileSync(keyPath);
    const ca = caPath && fs.existsSync(caPath) ? fs.readFileSync(caPath) : undefined;

    credentials = ServerCredentials.createSsl(
      ca ?? null,
      [{ private_key: key, cert_chain: cert }],
      // Set to true to require and verify client certificates (mTLS).
      !!ca,
    );
    logger.log(`gRPC server starting with TLS${ca ? ' (mTLS enforced)' : ''}`);
  } else {
    credentials = ServerCredentials.createInsecure();
    if (isProduction) {
      logger.warn(
        'gRPC TLS is DISABLED in a production environment. Enable GRPC_TLS_ENABLED and terminate ' +
          'mTLS at the service (or rely on a service-mesh sidecar) before exposing this beyond a trusted network.',
      );
    }
  }

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: grpcPackage,
      protoPath: path.join(__dirname, 'proto/payment.proto'),
      url: grpcUrl,
      credentials,
      loader: {
        keepCase: true,
        longs: String,
        enums: Number,
        defaults: true,
        oneofs: true,
      },
    },
  });

  await app.startAllMicroservices();
  logger.log(`gRPC microservice listening on ${grpcUrl}`);

  const port = config.get<number>('port')!;
  await app.listen(port);
  logger.log(`HTTP server (webhooks/health) listening on port ${port}`);

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down gracefully...`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
