import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PaymentNotFoundException, DuplicatePaymentException, PaymentGatewayException } from '../../application/exceptions/payment.exceptions';

/**
 * Global HTTP error handler. Ensures a consistent error envelope and,
 * critically, never reflects internal error details (stack traces,
 * DB errors, upstream Paystack error bodies) back to the caller in
 * production — only a safe, generic message.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message } = this.resolve(exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}: ${(exception as Error)?.message}`,
        (exception as Error)?.stack,
      );
    }

    const isProd = process.env.NODE_ENV === 'production';

    response.status(status).json({
      statusCode: status,
      message: status >= 500 && isProd ? 'Internal server error' : message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private resolve(exception: unknown): { status: number; message: string } {
    if (exception instanceof PaymentNotFoundException) {
      return { status: HttpStatus.NOT_FOUND, message: exception.message };
    }
    if (exception instanceof DuplicatePaymentException) {
      return { status: HttpStatus.CONFLICT, message: exception.message };
    }
    if (exception instanceof PaymentGatewayException) {
      return { status: HttpStatus.BAD_GATEWAY, message: exception.message };
    }
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        typeof response === 'string' ? response : (response as { message?: string }).message;
      return {
        status: exception.getStatus(),
        message: Array.isArray(message) ? message.join('; ') : message ?? exception.message,
      };
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }
}
