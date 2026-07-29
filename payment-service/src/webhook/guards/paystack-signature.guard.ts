import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { verifyPaystackSignature } from '../../common/utils/crypto.util';

/**
 * Verifies the `x-paystack-signature` header using HMAC-SHA512 against
 * the raw request body, per Paystack's webhook security requirements:
 * https://paystack.com/docs/payments/webhooks/#verifying-events
 *
 * Requests without a valid signature are rejected with 403 before any
 * business logic runs. Comparison is constant-time (see crypto.util.ts).
 */
@Injectable()
export class PaystackSignatureGuard implements CanActivate {
  private readonly logger = new Logger(PaystackSignatureGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const secretKey = this.configService.get<string>('paystack.secretKey')!;

    const signature = request.headers['x-paystack-signature'] as string | undefined;
    const rawBody = request.body as Buffer;

    if (!Buffer.isBuffer(rawBody)) {
      this.logger.error('Webhook body was not captured as a raw Buffer — check middleware order');
      throw new ForbiddenException('Invalid request');
    }

    const isValid = verifyPaystackSignature(rawBody, signature, secretKey);
    if (!isValid) {
      this.logger.warn(`Rejected webhook with invalid signature from ip=${request.ip}`);
      throw new ForbiddenException('Invalid webhook signature');
    }

    return true;
  }
}
