import { Injectable, NestMiddleware } from '@nestjs/common';
import { raw } from 'express';
import { Request, Response, NextFunction } from 'express';

/**
 * Captures the exact raw request bytes for webhook routes. Paystack's
 * HMAC-SHA512 signature is computed over the raw JSON body — if Express's
 * default JSON body-parser re-serializes the payload before we hash it,
 * whitespace/key-order differences would make every signature check fail
 * (or worse, tempt someone into trusting an unverified re-serialization).
 */
@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  private readonly parser = raw({ type: '*/*', limit: '1mb' });

  use(req: Request, res: Response, next: NextFunction) {
    this.parser(req, res, next);
  }
}
