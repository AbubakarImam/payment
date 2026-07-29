import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { throwError } from 'rxjs';
import {
  DuplicatePaymentException,
  InvalidPaymentStateException,
  PaymentGatewayException,
  PaymentNotFoundException,
} from '../../application/exceptions/payment.exceptions';

/**
 * Translates domain/application exceptions into proper gRPC status codes
 * instead of leaking stack traces or generic UNKNOWN errors to callers.
 */
@Catch()
export class GrpcExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GrpcExceptionFilter.name);

  catch(exception: unknown, _host: ArgumentsHost) {
    if (exception instanceof RpcException) {
      return throwError(() => exception.getError());
    }

    if (exception instanceof PaymentNotFoundException) {
      return throwError(() => ({ code: GrpcStatus.NOT_FOUND, message: exception.message }));
    }

    if (exception instanceof DuplicatePaymentException) {
      return throwError(() => ({ code: GrpcStatus.ALREADY_EXISTS, message: exception.message }));
    }

    if (exception instanceof InvalidPaymentStateException) {
      return throwError(() => ({
        code: GrpcStatus.FAILED_PRECONDITION,
        message: exception.message,
      }));
    }

    if (exception instanceof PaymentGatewayException) {
      this.logger.error(`Gateway error: ${exception.message}`);
      return throwError(() => ({ code: GrpcStatus.UNAVAILABLE, message: exception.message }));
    }

    // Validation errors thrown by the ValidationPipe surface as an array
    // of constraint messages or an object with `message`.
    const message = (exception as Error)?.message ?? 'Internal error';
    if (Array.isArray((exception as any)?.response?.message)) {
      return throwError(() => ({
        code: GrpcStatus.INVALID_ARGUMENT,
        message: (exception as any).response.message.join('; '),
      }));
    }

    this.logger.error(`Unhandled exception in gRPC handler: ${message}`, (exception as Error)?.stack);
    return throwError(() => ({ code: GrpcStatus.INTERNAL, message: 'Internal server error' }));
  }
}
