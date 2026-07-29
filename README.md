# Paystack Payment Microservice

A standalone, production-ready NestJS microservice that wraps Paystack and
replaces a PayPal-based payment integration. Other internal services talk to
it over **gRPC** for synchronous calls (initialize/verify/refund) and consume
**RabbitMQ** domain events for asynchronous notification of payment outcomes.
Paystack itself talks to it over a signed **HTTPS webhook**.

```
payment/
├── payment-service/            # the microservice itself
│   ├── src/
│   │   ├── domain/             # entities, enums, ports (interfaces) — no framework code
│   │   ├── application/        # use-case orchestration (PaymentService, WebhookProcessorService)
│   │   ├── infrastructure/     # adapters: Paystack HTTP client, Prisma repo, RabbitMQ publisher
│   │   ├── grpc/                # gRPC controller (proto <-> DTO translation, auth, error mapping)
│   │   ├── webhook/             # HTTP webhook controller + signature/IP guards
│   │   ├── common/              # cross-cutting: guards, filters, interceptors, crypto/redact utils
│   │   ├── config/              # ConfigModule setup, Joi validation, secrets-provider abstraction
│   │   ├── health/               # liveness endpoint
│   │   ├── proto/payment.proto   # gRPC contract
│   │   └── main.ts               # hybrid HTTP + gRPC bootstrap
│   ├── prisma/schema.prisma
│   ├── Dockerfile
│   └── .env.example
├── example-consumer-service/   # example of another service calling payment-service
├── docker-compose.yml          # payment-service + Postgres + RabbitMQ
└── .env.example                # docker-compose variables
```

This follows a light **hexagonal / clean architecture**: `domain` defines
ports (`IPaymentGateway`, `IPaymentRepository`, `IEventPublisher`);
`application` contains the only business logic and depends solely on those
ports; `infrastructure` provides concrete adapters (Paystack REST client,
Prisma repository, RabbitMQ publisher); `grpc` and `webhook` are thin
transport adapters that translate wire formats and delegate to
`application`. Swapping Paystack for another PSP, or Postgres for another
store, touches only `infrastructure` — never `application` or `domain`.

## Architecture diagram (description)

```
                     ┌─────────────────────┐
   Paystack ───HTTPS─▶  POST /webhooks/     │
   webhook            │  paystack            │
   (HMAC-SHA512        │  (signature + IP     │
    signed)            │   verified)          │
                     └─────────┬────────────┘
                               │
┌───────────────┐   gRPC      ▼
│ Other internal │───────▶ ┌─────────────────────────┐        ┌───────────┐
│ microservices  │◀───────│     payment-service       │──────▶│ Postgres   │
│ (orders, etc.) │  reply  │  (application core:       │       │ (Prisma)   │
└───────────────┘         │  PaymentService,           │       └───────────┘
        ▲                 │  WebhookProcessorService)   │
        │  subscribes     └──────────┬──────────────────┘
        │  to events                 │ publishes
        │                            ▼
        │                 ┌─────────────────────┐
        └─────────────────│   RabbitMQ            │
                           │ exchange:             │
                           │  payment.events (topic)│
                           │ routing keys:          │
                           │  payment.initialized    │
                           │  payment.successful      │
                           │  payment.failed           │
                           │  payment.refunded          │
                           └─────────────────────────┘
                                        │
                                        ▼  HTTPS (server-to-server, never
                                Paystack REST API   card data)
```

- **Inbound synchronous**: internal services → gRPC (`InitializePayment`,
  `VerifyPayment`, `GetPaymentStatus`, `RefundPayment`), authenticated via a
  shared-secret metadata header (or mTLS — see below).
- **Inbound asynchronous**: Paystack → HTTPS webhook, authenticated via
  HMAC-SHA512 signature + optional IP allow-list.
- **Outbound synchronous**: payment-service → Paystack REST API (server-side
  only, secret key never leaves this process).
- **Outbound asynchronous**: payment-service → RabbitMQ topic exchange
  `payment.events`; any interested service binds its own queue to the
  routing keys it cares about (`payment.*` for everything, or e.g.
  `payment.successful` only).

## How to run locally

### Option A — Docker Compose (recommended)

```bash
cp .env.example .env
# edit .env: set PAYSTACK_SECRET_KEY / PAYSTACK_PUBLIC_KEY (test keys from
# https://dashboard.paystack.com/#/settings/developer) and GRPC_SHARED_SECRET

docker compose up --build
```

This starts Postgres, RabbitMQ (with the management UI at
http://localhost:15672, guest/guest), runs `prisma migrate deploy` once via
the `payment-service-migrate` one-shot service, then starts `payment-service`
with:
- HTTP (webhooks/health) on `:3000`
- gRPC on `:5000`

Check it's up: `curl http://localhost:3000/health`

### Option B — run payment-service directly

```bash
cd payment-service
cp .env.example .env       # point DATABASE_URL / RABBITMQ_URL at local instances
npm install
npm run prisma:generate
npm run prisma:migrate:dev
npm run start:dev
```

You'll need a local Postgres and RabbitMQ (or run just those two from
`docker compose up postgres rabbitmq`).

### Exposing your webhook to Paystack in development

Paystack needs a public HTTPS URL to deliver webhooks. Use a tunnel:

```bash
ngrok http 3000
```

Then set the webhook URL in the Paystack dashboard to
`https://<your-ngrok-id>.ngrok.io/webhooks/paystack`. Since ngrok's IP isn't
in Paystack's published range, set `PAYSTACK_WEBHOOK_IP_ALLOWLIST_ENABLED=false`
locally (signature verification alone is still enforced and is the
authoritative check).

## Testing the payment flow end-to-end

1. **Initialize a payment** via gRPC. Using [`grpcurl`](https://github.com/fullstorydev/grpcurl):

   ```bash
   grpcurl -plaintext \
     -H "authorization: Bearer $GRPC_SHARED_SECRET" \
     -import-path payment-service/src/proto -proto payment.proto \
     -d '{
       "amount": 500000,
       "email": "customer@example.com",
       "currency": "NGN",
       "idempotency_key": "test-idem-key-0001",
       "callback_url": "https://example.com/callback"
     }' \
     localhost:5000 payment.PaymentService/InitializePayment
   ```

   Response includes `authorization_url` — open it in a browser and pay with
   a [Paystack test card](https://paystack.com/docs/payments/test-payments/)
   (e.g. `4084084084084081`, any future expiry, CVV `408`, PIN `0000`,
   OTP `123456`).

2. **Paystack fires the webhook** (`charge.success`) to
   `/webhooks/paystack` automatically. Watch the payment-service logs — you
   should see the signature verified, the payment marked `SUCCESSFUL`, and
   a `PaymentSuccessful` event published.

3. **Confirm the event landed in RabbitMQ**: open the management UI
   (http://localhost:15672) → Exchanges → `payment.events`, or run the
   `example-consumer-service` (below) and watch its logs.

4. **Verify/query via gRPC**:

   ```bash
   grpcurl -plaintext -H "authorization: Bearer $GRPC_SHARED_SECRET" \
     -import-path payment-service/src/proto -proto payment.proto \
     -d '{"reference": "pay_xxxxxxxxxxxxxxxxxxxxxxxx"}' \
     localhost:5000 payment.PaymentService/VerifyPayment
   ```

5. **Run the example consumer**:

   ```bash
   cd example-consumer-service
   cp .env.example .env
   npm install
   npm run start:dev
   ```

   It exposes `POST /demo/checkout` (calls `InitializePayment` via gRPC) and
   subscribes to `payment.events`, logging every event it receives —
   demonstrating the full loop: gRPC call in, RabbitMQ event out.

### Simulating a webhook without a real Paystack transaction

You can hand-craft a signed request to exercise the webhook path in
isolation:

```bash
BODY='{"event":"charge.success","data":{"reference":"pay_test123","amount":500000,"currency":"NGN","status":"success","channel":"card","gateway_response":"Successful","paid_at":"2026-07-29T10:00:00.000Z","customer":{"email":"customer@example.com"}}}'
SIG=$(echo -n "$BODY" | openssl dgst -sha512 -hmac "$PAYSTACK_SECRET_KEY" | sed 's/^.* //')

curl -X POST http://localhost:3000/webhooks/paystack \
  -H "Content-Type: application/json" \
  -H "x-paystack-signature: $SIG" \
  -d "$BODY"
```

(Requires a `Payment` row with reference `pay_test123` to already exist —
run `InitializePayment` first with `"reference": "pay_test123"`.)

## Security checklist (implemented)

| Requirement | Implementation |
|---|---|
| Never hardcode/expose the Paystack secret key | Loaded via `ConfigModule` from env (`PAYSTACK_SECRET_KEY`), validated at startup by Joi (`config/validation.schema.ts`), used only inside `PaystackService` (`infrastructure/paystack/paystack.service.ts`), never logged (see redaction below). |
| Verify every webhook signature (HMAC-SHA512) | `common/utils/crypto.util.ts#verifyPaystackSignature` computes `HMAC_SHA512(secret, rawBody)` and compares against `x-paystack-signature`; enforced by `PaystackSignatureGuard` before any webhook logic runs. Raw bytes are preserved via `RawBodyMiddleware` so the hash matches exactly what Paystack signed. |
| Constant-time signature/secret comparison | `crypto.timingSafeEqual` used in both `verifyPaystackSignature` and `constantTimeEquals` (used by `GrpcAuthGuard`). |
| HTTPS only in production | Documented requirement — terminate TLS at the ingress/load balancer (or enable `GRPC_TLS_ENABLED` for gRPC transport TLS/mTLS, see `main.ts`); `main.ts` logs a warning if gRPC TLS is disabled while `NODE_ENV=production`. |
| Rate limiting | `@nestjs/throttler` applied globally (`app.module.ts`, `APP_GUARD`) and with a stricter/looser override on the webhook route via `@Throttle` (`webhook.controller.ts`). |
| IP allow-listing for webhooks | `WebhookIpAllowlistGuard` checks `req.ip` (respecting `trust proxy`) against `PAYSTACK_WEBHOOK_IP_ALLOWLIST`; toggleable since Paystack's IPs can change and some deployments front the service with infra-level restrictions instead. |
| Sanitize/validate all input | `class-validator`/`class-transformer` DTOs for every operation (`application/dto/*`) enforcing type, format (email, URL, alphanumeric reference), and bounds (positive integer amounts, currency allow-list); enforced both at the gRPC boundary (manual `validate()` call in `grpc/payment.controller.ts`) and globally for HTTP (`ValidationPipe` in `main.ts`). |
| Short-lived, unpredictable references | `common/utils/reference.util.ts` generates cryptographically-random 24-char nanoid references with no embedded PII/sequential info. |
| Never store full card details | Prisma schema (`prisma/schema.prisma`) has no card/PAN/CVV fields at all — card capture happens entirely on Paystack's hosted checkout; the service only ever sees Paystack's tokenized `reference`/`access_code`. |
| CORS, Helmet, security headers | `helmet()` and `app.enableCors({ origin: <allow-list> })` configured in `main.ts`. |
| Idempotency for payment initialization (and refunds) | `idempotency_key` is a required, validated field on `InitializePaymentDto`/`RefundPaymentDto`; `PaymentService` checks `IdempotencyRecord`/`Payment.idempotencyKey` before calling Paystack and returns the original result on replay, preventing duplicate charges/refunds from retried calls. |
| Secure gRPC (auth / mTLS-ready) | `GrpcAuthGuard` enforces a shared-secret bearer token on every RPC (fail-closed if unset); `main.ts` supports `GRPC_TLS_ENABLED` to serve gRPC over TLS with optional client-cert verification (mTLS) via `ServerCredentials.createSsl`. |
| Production secrets management readiness | `config/secrets/` defines an `ISecretsProvider` abstraction with stub adapters for AWS Secrets Manager and HashiCorp Vault (`SECRETS_PROVIDER` env toggle) — swap in real SDK calls without touching any consuming code, since everything reads secrets through `ConfigService`. |
| Never log secrets / card data / sensitive info | `common/utils/redact.util.ts` deep-redacts known-sensitive keys (`authorization`, `secret`, `token`, `cvv`, signature headers, etc.) before anything is logged; used by `LoggingInterceptor`, `PaystackService`'s request logging, and `RabbitMqPublisherService`'s publish logging. |
| OWASP API Security Top 10 | Broken object-level auth → references are unguessable + scoped lookups by reference; excessive data exposure → gRPC/HTTP responses return only defined fields, no raw Paystack payloads; injection → all input validated/whitelisted, Prisma parameterizes queries; rate limiting → Throttler; security misconfiguration → fail-fast env validation (Joi) refuses to boot with missing secrets; logging/monitoring → structured logs with redaction on every request. |

**Not included / requires infra-level setup**: TLS certificate provisioning
itself (use your platform's cert manager / ACM / Let's Encrypt), a real
AWS Secrets Manager or Vault client (stubs provided, see
`config/secrets/`), and a WAF/DDoS layer (recommend fronting with
Cloudflare/API Gateway in production).

## Extending

- **mTLS for gRPC**: set `GRPC_TLS_ENABLED=true`, provide
  `GRPC_TLS_CERT_PATH`/`GRPC_TLS_KEY_PATH`/`GRPC_TLS_CA_PATH`; `main.ts`
  automatically requires+verifies client certs when a CA is supplied.
- **Swap PSPs**: implement `IPaymentGateway` (see
  `domain/interfaces/payment-gateway.interface.ts`) and provide it in place
  of `PaystackModule` — `application/services/payment.service.ts` needs no
  changes.
- **Secrets manager**: implement `ISecretsProvider.load()` in
  `config/secrets/aws-secrets-manager.provider.ts` (or `vault.provider.ts`),
  wire it into the `ConfigModule` factory, set `SECRETS_PROVIDER`.
