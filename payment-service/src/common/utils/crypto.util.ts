import * as crypto from 'crypto';

/**
 * Verifies a Paystack webhook signature using HMAC-SHA512, per Paystack's
 * documented scheme: hash = HMAC_SHA512(secretKey, rawRequestBody) and
 * compare against the `x-paystack-signature` header.
 *
 * Uses crypto.timingSafeEqual to avoid leaking information via timing
 * side-channels during comparison.
 */
export function verifyPaystackSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  secretKey: string,
): boolean {
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return false;
  }

  const expectedHash = crypto
    .createHmac('sha512', secretKey)
    .update(rawBody)
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedHash, 'utf8');
  const providedBuffer = Buffer.from(signatureHeader, 'utf8');

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

/**
 * Constant-time string comparison for shared-secret / API-key style checks
 * (e.g. gRPC metadata authentication).
 */
export function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) {
    // Still run a comparison of equal-length buffers to avoid an early
    // length-based timing signal being the only differentiator.
    crypto.timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Deterministic dedup key for an inbound webhook payload, used to guard
 * against duplicate/replayed event processing (idempotency).
 */
export function hashWebhookPayload(rawBody: Buffer | string): string {
  return crypto.createHash('sha256').update(rawBody).digest('hex');
}
