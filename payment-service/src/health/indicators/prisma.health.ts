import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';

/**
 * Confirms the database connection is actually usable, not just that
 * `PrismaService` connected once at startup — a query round-trip catches
 * a since-dropped connection a boolean "connected" flag would miss.
 */
@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (err) {
      throw new HealthCheckError(
        'Database check failed',
        this.getStatus(key, false, { message: (err as Error).message }),
      );
    }
  }
}
