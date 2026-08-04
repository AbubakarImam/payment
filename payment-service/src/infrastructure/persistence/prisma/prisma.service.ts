import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Prisma's log-event typings depend on the exact `log` config passed to the
 * constructor — declaring the emitted levels as a type parameter here (
 * instead of leaving them to be inferred, or suppressing the mismatch with
 * `@ts-expect-error`) is what gives `$on('error', ...)` a properly typed
 * `Prisma.LogEvent` callback below.
 */
type PrismaLogEvent = 'query' | 'error' | 'warn';

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, PrismaLogEvent>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    this.$on('error', (event: Prisma.LogEvent) => this.logger.error(event.message));
    this.$on('warn', (event: Prisma.LogEvent) => this.logger.warn(event.message));

    await this.$connect();
    this.logger.log('Connected to database');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
