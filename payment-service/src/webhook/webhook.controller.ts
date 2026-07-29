import {
  BadRequestException,
  Controller,
  HttpCode,
  InternalServerErrorException,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { PaystackSignatureGuard } from './guards/paystack-signature.guard';
import { WebhookIpAllowlistGuard } from './guards/webhook-ip-allowlist.guard';
import { WebhookProcessorService, PaystackWebhookPayload } from '../application/services/webhook-processor.service';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookProcessor: WebhookProcessorService) {}

  @Post('paystack')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @UseGuards(WebhookIpAllowlistGuard, PaystackSignatureGuard)
  async handlePaystackWebhook(@Req() request: Request): Promise<{ received: boolean }> {
    const rawBody = request.body as Buffer;

    let payload: PaystackWebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Malformed JSON payload');
    }

    if (!payload?.event || !payload?.data?.reference) {
      throw new BadRequestException('Missing required webhook fields');
    }

    // Processing is guarded by the WebhookEvent dedup table (keyed off a
    // hash of the raw body), so it's safe to let a genuine processing
    // failure surface as a 5xx here — Paystack will retry delivery, and
    // the retry will either succeed or be a harmless no-op if it turns
    // out we'd actually already committed the update.
    try {
      await this.webhookProcessor.process(rawBody, payload);
    } catch (err) {
      this.logger.error(`Failed to process webhook event=${payload.event}: ${(err as Error).message}`);
      throw new InternalServerErrorException('Failed to process webhook event');
    }

    return { received: true };
  }
}
