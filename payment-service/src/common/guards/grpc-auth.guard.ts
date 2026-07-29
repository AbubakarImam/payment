import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { constantTimeEquals } from '../utils/crypto.util';

/**
 * Minimal shared-secret authentication for inter-service gRPC calls.
 * Trusted callers must send metadata `authorization: Bearer <secret>`.
 *
 * This is a stopgap for environments without a service mesh / mTLS. For
 * stronger guarantees, enable GRPC_TLS_ENABLED (mutual TLS — see
 * main.ts) so both transport-level identity and this app-level secret
 * are enforced (defense in depth).
 */
@Injectable()
export class GrpcAuthGuard implements CanActivate {
  private readonly logger = new Logger(GrpcAuthGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const rpcContext = context.switchToRpc();
    const metadata = rpcContext.getContext();

    const expectedSecret = this.configService.get<string>('grpc.sharedSecret');
    if (!expectedSecret) {
      // Fail closed: never allow unauthenticated gRPC calls.
      this.logger.error('GRPC_SHARED_SECRET is not configured — rejecting call');
      throw new RpcException({ code: GrpcStatus.UNAUTHENTICATED, message: 'Server misconfigured' });
    }

    const authHeader: string | undefined = metadata?.get?.('authorization')?.[0];
    const provided = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    if (!provided || !constantTimeEquals(provided, expectedSecret)) {
      throw new RpcException({ code: GrpcStatus.UNAUTHENTICATED, message: 'Invalid credentials' });
    }

    return true;
  }
}
