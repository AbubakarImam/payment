const SENSITIVE_KEYS = new Set([
  'authorization',
  'secret',
  'secretkey',
  'paystack_secret_key',
  'password',
  'token',
  'apikey',
  'api_key',
  'cardnumber',
  'card_number',
  'cvv',
  'pin',
  'x-paystack-signature',
]);

/**
 * Deep-clones an object/array/primitive and masks any key that looks
 * sensitive so it can never end up in application logs. Used by the
 * logging interceptor and anywhere we log request/response payloads.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        result[key] = '***REDACTED***';
      } else {
        result[key] = redact(val, depth + 1);
      }
    }
    return result;
  }

  return value;
}
