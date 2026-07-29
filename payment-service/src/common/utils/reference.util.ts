import { customAlphabet } from 'nanoid';

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nano = customAlphabet(alphabet, 24);

/**
 * Generates a short-lived, unpredictable, URL-safe transaction reference.
 * Prefixed for easy grep-ability in logs/dashboards without leaking any
 * sensitive data (contains no PII, timestamps only to the hour granularity
 * would be too identifying, so we omit them entirely).
 */
export function generatePaymentReference(): string {
  return `pay_${nano()}`;
}

export function generateRefundReference(): string {
  return `rfd_${nano()}`;
}
