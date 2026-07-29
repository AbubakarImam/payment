import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Optional defense-in-depth layer: rejects webhook calls from IPs outside
 * Paystack's published range. Disable via PAYSTACK_WEBHOOK_IP_ALLOWLIST_ENABLED
 * when running behind infra that already restricts inbound traffic (e.g.
 * a private VPC endpoint) or during local development with a tunnel
 * (ngrok/localtunnel), since Paystack's IPs can change — keep this list
 * updated from https://paystack.com/docs/payments/webhooks/#ip-whitelisting
 * and never rely on it as the SOLE control; signature verification
 * (PaystackSignatureGuard) is the authoritative check.
 */
@Injectable()
export class WebhookIpAllowlistGuard implements CanActivate {
  private readonly logger = new Logger(WebhookIpAllowlistGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const enabled = this.configService.get<boolean>('paystack.webhookIpAllowlistEnabled');
    if (!enabled) return true;

    const allowlist = this.configService.get<string[]>('paystack.webhookIpAllowlist') ?? [];
    if (allowlist.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.extractClientIp(request);

    if (!allowlist.includes(clientIp)) {
      this.logger.warn(`Rejected webhook from non-allowlisted ip=${clientIp}`);
      throw new ForbiddenException('Source IP not allowed');
    }

    return true;
  }

  private extractClientIp(request: Request): string {
    // req.ip respects Express's `trust proxy` setting (configured in
    // main.ts) so this reflects the real client IP behind a load balancer.
    return request.ip ?? '';
  }
}
