import * as Joi from 'joi';

/**
 * Fail-fast startup validation. If any required secret/config is missing
 * or malformed, the service refuses to boot rather than run in a
 * partially-configured (and potentially insecure) state.
 */
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'staging', 'production').default('development'),
  PORT: Joi.number().default(3000),
  GRPC_URL: Joi.string().default('0.0.0.0:5000'),
  GRPC_PACKAGE: Joi.string().default('payment'),

  PAYSTACK_SECRET_KEY: Joi.string().min(20).required(),
  PAYSTACK_PUBLIC_KEY: Joi.string().min(20).required(),
  PAYSTACK_BASE_URL: Joi.string().uri().default('https://api.paystack.co'),
  PAYSTACK_WEBHOOK_PATH: Joi.string().default('/webhooks/paystack'),
  PAYSTACK_WEBHOOK_IP_ALLOWLIST: Joi.string().allow('').default(''),
  PAYSTACK_WEBHOOK_IP_ALLOWLIST_ENABLED: Joi.boolean().default(true),

  DATABASE_URL: Joi.string().required(),

  RABBITMQ_URL: Joi.string().uri().required(),
  RABBITMQ_EXCHANGE: Joi.string().default('payment.events'),
  RABBITMQ_EXCHANGE_TYPE: Joi.string().valid('topic', 'direct', 'fanout').default('topic'),
  RABBITMQ_PREFETCH_COUNT: Joi.number().default(10),

  GRPC_SHARED_SECRET: Joi.string().min(16).required(),
  GRPC_TLS_ENABLED: Joi.boolean().default(false),
  GRPC_TLS_CERT_PATH: Joi.string().when('GRPC_TLS_ENABLED', { is: true, then: Joi.required() }),
  GRPC_TLS_KEY_PATH: Joi.string().when('GRPC_TLS_ENABLED', { is: true, then: Joi.required() }),
  GRPC_TLS_CA_PATH: Joi.string().optional(),

  THROTTLE_TTL_MS: Joi.number().default(60000),
  THROTTLE_LIMIT: Joi.number().default(30),
  WEBHOOK_THROTTLE_TTL_MS: Joi.number().default(60000),
  WEBHOOK_THROTTLE_LIMIT: Joi.number().default(60),

  CORS_ALLOWED_ORIGINS: Joi.string().default(''),

  SECRETS_PROVIDER: Joi.string().valid('env', 'aws-secrets-manager', 'vault').default('env'),
  AWS_SECRETS_MANAGER_SECRET_ID: Joi.string().optional(),
  AWS_REGION: Joi.string().optional(),
  VAULT_ADDR: Joi.string().optional(),
  VAULT_SECRET_PATH: Joi.string().optional(),

  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug', 'verbose').default('info'),
});
