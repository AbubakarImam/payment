export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),

  grpc: {
    url: process.env.GRPC_URL ?? '0.0.0.0:5000',
    package: process.env.GRPC_PACKAGE ?? 'payment',
    sharedSecret: process.env.GRPC_SHARED_SECRET ?? '',
    tls: {
      enabled: process.env.GRPC_TLS_ENABLED === 'true',
      certPath: process.env.GRPC_TLS_CERT_PATH,
      keyPath: process.env.GRPC_TLS_KEY_PATH,
      caPath: process.env.GRPC_TLS_CA_PATH,
    },
  },

  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY ?? '',
    publicKey: process.env.PAYSTACK_PUBLIC_KEY ?? '',
    baseUrl: process.env.PAYSTACK_BASE_URL ?? 'https://api.paystack.co',
    webhookPath: process.env.PAYSTACK_WEBHOOK_PATH ?? '/webhooks/paystack',
    webhookIpAllowlist: (process.env.PAYSTACK_WEBHOOK_IP_ALLOWLIST ?? '')
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean),
    webhookIpAllowlistEnabled: process.env.PAYSTACK_WEBHOOK_IP_ALLOWLIST_ENABLED !== 'false',
  },

  database: {
    url: process.env.DATABASE_URL ?? '',
  },

  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
    exchange: process.env.RABBITMQ_EXCHANGE ?? 'payment.events',
    exchangeType: process.env.RABBITMQ_EXCHANGE_TYPE ?? 'topic',
    prefetchCount: parseInt(process.env.RABBITMQ_PREFETCH_COUNT ?? '10', 10),
  },

  throttle: {
    ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '30', 10),
    webhookTtlMs: parseInt(process.env.WEBHOOK_THROTTLE_TTL_MS ?? '60000', 10),
    webhookLimit: parseInt(process.env.WEBHOOK_THROTTLE_LIMIT ?? '60', 10),
  },

  cors: {
    allowedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  secretsProvider: process.env.SECRETS_PROVIDER ?? 'env',

  logLevel: process.env.LOG_LEVEL ?? 'info',
});
