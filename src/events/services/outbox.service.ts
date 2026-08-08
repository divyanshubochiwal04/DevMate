import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { loggerContextStorage } from '../../common/logger/logger-context';
import { randomUUID } from 'crypto';

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async publish(
    event: { eventName: string; aggregateId?: string; aggregateType?: string; userId?: string; payload: any },
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || this.prisma;
    const eventId = randomUUID();
    const store = loggerContextStorage.getStore();
    const requestId = store?.requestId || null;
    const correlationId = store?.correlationId || null;

    await client.outboxEvent.create({
      data: {
        eventId,
        eventType: event.eventName,
        aggregateType: event.aggregateType || null,
        aggregateId: event.aggregateId || null,
        payload: event.payload,
        status: 'PENDING',
        metadata: event.userId ? { userId: event.userId } : undefined,
        requestId,
        correlationId,
      },
    });
  }
}
