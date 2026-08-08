import { Injectable, OnApplicationBootstrap, OnApplicationShutdown, Inject } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '../../config/config.service';
import { EventHandlerRegistry } from './event-handler-registry.service';
import { CustomLogger } from '../../common/logger/custom-logger.service';
import { scrubString } from '../../common/logger/custom-logger.service';
import { IEventBus } from '../../telegram/interfaces/event-bus.interface';
import { randomUUID } from 'crypto';

@Injectable()
export class OutboxDispatcherService implements OnApplicationBootstrap, OnApplicationShutdown {
  private polling = false;
  private timer: NodeJS.Timeout | null = null;
  private activeJobsCount = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly registry: EventHandlerRegistry,
    private readonly logger: CustomLogger,
    @Inject(IEventBus) private readonly eventBus: IEventBus
  ) {
    this.logger.setContext('OutboxDispatcherService');
  }

  onApplicationBootstrap() {
    this.logger.log('Starting Transactional Outbox background dispatcher...');
    this.polling = true;
    this.scheduleNextPoll();
  }

  stop() {
    this.polling = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async onApplicationShutdown() {
    this.logger.log('Shutting down Transactional Outbox background dispatcher...');
    this.stop();

    // Wait briefly for active processing to complete
    let retries = 0;
    while (this.activeJobsCount > 0 && retries < 10) {
      this.logger.log(`Waiting for ${this.activeJobsCount} active outbox jobs to finish...`);
      await new Promise(resolve => setTimeout(resolve, 500));
      retries++;
    }
  }

  private scheduleNextPoll() {
    if (!this.polling) return;
    this.timer = setTimeout(async () => {
      try {
        await this.pollAndProcess();
      } catch (err: any) {
        this.logger.error(`Error in outbox polling tick: ${err.message}`);
      } finally {
        this.scheduleNextPoll();
      }
    }, this.config.outboxPollIntervalMs);
  }

  async pollAndProcess() {
    // 1. Recover stale locks
    try {
      const leaseLimit = new Date(Date.now() - this.config.outboxLockTimeoutMs);
      const recovered = await this.prisma.outboxEvent.updateMany({
        where: {
          status: 'PROCESSING',
          lockedAt: { lt: leaseLimit },
        },
        data: {
          status: 'RETRY',
          lockedAt: null,
          lockedBy: null,
        },
      });
      if (recovered.count > 0) {
        this.logger.warn(`Recovered ${recovered.count} stranded outbox events back to RETRY status.`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to recover stale outbox locks: ${err.message}`);
    }

    // 2. Claim events using row-level SKIP LOCKED
    const workerId = `worker-${randomUUID()}`;
    const batchSize = this.config.outboxBatchSize;
    let claimedIds: string[] = [];

    try {
      claimedIds = await this.prisma.$transaction(async tx => {
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM outbox_events
          WHERE status IN ('PENDING', 'RETRY') AND available_at <= NOW()
          ORDER BY created_at ASC
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        `;
        if (rows.length === 0) return [];
        const ids = rows.map(r => r.id);
        await tx.outboxEvent.updateMany({
          where: { id: { in: ids } },
          data: {
            status: 'PROCESSING',
            lockedAt: new Date(),
            lockedBy: workerId,
          },
        });
        return ids;
      });
    } catch (err: any) {
      this.logger.error(`Failed to claim outbox events batch: ${err.message}`);
      return;
    }

    if (claimedIds.length === 0) return;

    this.logger.debug(`Claimed ${claimedIds.length} outbox events to process.`);

    // 3. Fetch and process events sequentially to preserve aggregate ordering
    const events = await this.prisma.outboxEvent.findMany({
      where: { id: { in: claimedIds } },
      orderBy: { createdAt: 'asc' },
    });

    for (const event of events) {
      this.activeJobsCount++;
      try {
        await this.processEvent(event);
      } catch (err: any) {
        this.logger.error(`Failed processing event ${event.eventId}: ${err.message}`);
      } finally {
        this.activeJobsCount--;
      }
    }
  }

  private async processEvent(event: any) {
    const handlers = this.registry.getHandlers(event.eventType);

    if (handlers.length === 0) {
      // No handlers registered, mark as PROCESSED
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
        },
      });
      this.logger.debug(`Event ${event.eventId} (${event.eventType}) has no registered consumers. Marked PROCESSED.`);
      return;
    }

    let hasFailure = false;
    let lastErrorMsg = '';

    for (const { consumerName, handler } of handlers) {
      try {
        this.logger.debug(`Consumer "${consumerName}" started processing event ${event.eventId}`);
        // Run check-and-execute in a transaction
        await this.prisma.$transaction(async tx => {
          const processed = await tx.processedEvent.findUnique({
            where: {
              eventId_consumerName: {
                eventId: event.eventId,
                consumerName,
              },
            },
          });

          if (processed) {
            this.logger.debug(`Consumer "${consumerName}" already processed event ${event.eventId}. Skipping.`);
            return;
          }

          // Execute side effect handler
          await handler.handle(event.payload, event.eventType, tx);

          // Mark processed
          await tx.processedEvent.create({
            data: {
              eventId: event.eventId,
              consumerName,
            },
          });
        });
        this.logger.log(`Consumer "${consumerName}" successfully processed event ${event.eventId}`);
      } catch (err: any) {
        hasFailure = true;
        lastErrorMsg = err.message || 'Unknown error';
        this.logger.error(`Consumer "${consumerName}" failed processing event ${event.eventId}: ${lastErrorMsg}`);
        // Stop execution to preserve order and retry failing consumer
        break;
      }
    }

    // Determine final event status
    if (!hasFailure) {
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
        },
      });
      this.logger.log(`Event ${event.eventId} (${event.eventType}) successfully processed by all consumers.`);
      // Notify in-process observers (e.g. integration tests) — handlers have already run above.
      try {
        await this.eventBus.publish(event.eventType, event.payload);
      } catch (notifyErr: any) {
        this.logger.warn(`eventBus post-dispatch notify failed for ${event.eventType}: ${notifyErr.message}`);
      }
    } else {
      const sanitizedError = scrubString(lastErrorMsg);
      const nextAttempt = event.attemptCount + 1;

      if (nextAttempt >= event.maxAttempts) {
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: 'DEAD_LETTER',
            failedAt: new Date(),
            lastError: sanitizedError,
            attemptCount: nextAttempt,
            lockedAt: null,
            lockedBy: null,
          },
        });
        this.logger.error(`Event ${event.eventId} (${event.eventType}) exceeded max attempts. Moved to DEAD_LETTER.`);
      } else {
        // Calculate exponential backoff + jitter
        const baseDelay = this.config.outboxBaseRetryDelayMs;
        const maxDelay = this.config.outboxMaxRetryDelayMs;
        const expDelay = baseDelay * Math.pow(2, event.attemptCount);
        const jitter = Math.random() * 100;
        const delay = Math.min(maxDelay, expDelay) + jitter;

        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: 'RETRY',
            attemptCount: nextAttempt,
            availableAt: new Date(Date.now() + delay),
            lastError: sanitizedError,
            lockedAt: null,
            lockedBy: null,
          },
        });
        this.logger.warn(`Event ${event.eventId} (${event.eventType}) failed. Scheduled retry #${nextAttempt} in ${Math.round(delay)}ms.`);
      }
    }
  }

  // ─── Operational DLQ Methods ───
  async listDeadLetterEvents() {
    return this.prisma.outboxEvent.findMany({
      where: { status: 'DEAD_LETTER' },
      orderBy: { failedAt: 'desc' },
    });
  }

  async retryDeadLetterEvent(id: string) {
    const event = await this.prisma.outboxEvent.findUnique({
      where: { id },
    });
    if (!event || event.status !== 'DEAD_LETTER') {
      throw new Error(`Event ${id} is not in DEAD_LETTER status.`);
    }

    return this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: 'PENDING',
        attemptCount: 0,
        availableAt: new Date(),
        failedAt: null,
        lastError: null,
      },
    });
  }

  async inspectEventMetadata(id: string) {
    const event = await this.prisma.outboxEvent.findUnique({
      where: { id },
    });
    if (!event) {
      throw new Error(`Event ${id} not found.`);
    }
    return {
      id: event.id,
      eventId: event.eventId,
      eventType: event.eventType,
      status: event.status,
      attemptCount: event.attemptCount,
      metadata: event.metadata,
      createdAt: event.createdAt,
      failedAt: event.failedAt,
      lastError: event.lastError,
    };
  }
}
