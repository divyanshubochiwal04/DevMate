import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { ReminderRepository } from '../repositories/reminder.repository';
import { IReminderExecutor } from '../interfaces/reminder-executor.interface';
import { IEventBus } from '../../telegram/interfaces/event-bus.interface';
import { ReminderStatus, RetryStrategy, Reminder } from '@prisma/client';
import {
  ReminderTriggeredEventPayload,
  ReminderCompletedEventPayload,
  ReminderFailedEventPayload,
} from '../events/reminder-events';
import { CustomLogger } from '../../common/logger/custom-logger.service';
import { OutboxService } from '../../events/services/outbox.service';

@Injectable()
export class ReminderSchedulerService {
  constructor(
    private readonly repository: ReminderRepository,
    @Inject(IReminderExecutor) private readonly executor: IReminderExecutor,
    @Inject(IEventBus) private readonly eventBus: IEventBus,
    private readonly logger: CustomLogger,
    private readonly outboxService: OutboxService
  ) {
    this.logger.setContext('ReminderSchedulerService');
  }

  async triggerReminder(
    executionId: string,
    reminderId: string,
    triggerSource: string,
    workerId?: string,
    simulateFailure = false
  ): Promise<void> {
    const startTime = Date.now();
    this.logger.log(`Triggering execution ${executionId} for reminder ${reminderId}`);

    // 1. Fetch the reminder
    const reminder = await this.repository.findById(reminderId);
    if (!reminder) {
      this.logger.error(`Reminder ${reminderId} not found`);
      return;
    }

    if (
      reminder.status === ReminderStatus.COMPLETED ||
      reminder.status === ReminderStatus.CANCELLED ||
      reminder.status === ReminderStatus.FAILED
    ) {
      this.logger.log(`Reminder ${reminderId} is in terminal state: ${reminder.status}. Aborting.`);
      return;
    }

    // 2. Idempotency Check: Verify if executionId was already run
    const existingHistory = await this.repository.findHistoryByExecutionId(executionId);
    if (existingHistory) {
      this.logger.log(`Execution ${executionId} has already run (idempotent no-op).`);
      return;
    }

    const testMockSuccess = !simulateFailure;

    // 3. Mark state as RUNNING in DB
    await this.repository.update(reminderId, reminder.version, {
      status: ReminderStatus.RUNNING,
      lastExecutedAt: new Date(),
    });

    // 4. Emit Triggered Event
    await this.eventBus.publish(
      ReminderTriggeredEventPayload.eventName,
      new ReminderTriggeredEventPayload(reminderId, reminder.userId, executionId, triggerSource)
    );

    const duration = Date.now() - startTime;

    if (testMockSuccess) {
      // ─── Success Path ───
      this.logger.log(`Reminder ${reminderId} executed successfully.`);
      
      let nextStatus: ReminderStatus = ReminderStatus.COMPLETED;
      let nextExecution: Date | null = null;
      let occurrenceCount = 0;

      if (reminder.rule) {
        occurrenceCount = reminder.rule.occurrenceCount + 1;
        const maxReached = reminder.rule.maxOccurrences && occurrenceCount >= reminder.rule.maxOccurrences;
        const timeLimitReached = reminder.rule.endAt && Date.now() >= reminder.rule.endAt.getTime();

        if (maxReached || timeLimitReached) {
          nextStatus = ReminderStatus.COMPLETED;
        } else {
          // Calculate next recurrence date
          nextStatus = ReminderStatus.SCHEDULED;
          nextExecution = this.calculateNextRecurrence(reminder.rule.frequency, reminder.nextExecutionAt || reminder.triggerTime);
        }
      }

      await this.repository.update(
        reminderId,
        reminder.version + 1,
        {
          status: nextStatus,
          nextExecutionAt: nextExecution,
          retryCount: 0, // reset retry counter on success
        },
        reminder.rule
          ? {
              frequency: reminder.rule.frequency,
              occurrenceCount,
            }
          : undefined
      );

      // Save execution duration and success state
      await this.repository.saveHistory(executionId, {
        reminderId,
        triggerSource,
        workerId,
        scheduledAt: reminder.nextExecutionAt || reminder.triggerTime,
        executedAt: new Date(),
        duration,
        result: ReminderStatus.COMPLETED,
        retry: reminder.retryCount,
      });

      await this.outboxService.publish({
        eventName: ReminderCompletedEventPayload.eventName,
        aggregateType: 'Reminder',
        aggregateId: reminderId,
        userId: reminder.userId,
        payload: new ReminderCompletedEventPayload(reminderId, reminder.userId, new Date())
      });

      if (nextExecution) {
        await this.executor.schedule(reminderId, nextExecution);
      }
    } else {
      // ─── Failure Path ───
      this.logger.log(`Reminder ${reminderId} execution failed.`);
      const nextRetryCount = reminder.retryCount + 1;

      if (nextRetryCount <= reminder.maxRetries) {
        const backoffSeconds = this.calculateBackoff(reminder.retryStrategy, nextRetryCount);
        const retryAt = new Date(Date.now() + backoffSeconds * 1000);

        this.logger.log(`Scheduling retry #${nextRetryCount} for reminder ${reminderId} at ${retryAt}`);
        
        await this.repository.update(reminderId, reminder.version + 1, {
          status: ReminderStatus.SNOOZED,
          nextExecutionAt: retryAt,
          retryCount: nextRetryCount,
        });

        await this.repository.saveHistory(executionId, {
          reminderId,
          triggerSource,
          workerId,
          scheduledAt: reminder.nextExecutionAt || reminder.triggerTime,
          executedAt: new Date(),
          duration,
          result: ReminderStatus.FAILED,
          error: 'Execution simulated failure',
          retry: nextRetryCount,
        });

        await this.eventBus.publish(
          ReminderFailedEventPayload.eventName,
          new ReminderFailedEventPayload(reminderId, reminder.userId, new Date(), 'Execution simulated failure')
        );

        await this.executor.schedule(reminderId, retryAt);
      } else {
        // Dead Letter State (FAILED)
        this.logger.log(`Reminder ${reminderId} exceeded max retries. Moving to Dead Letter (FAILED) state.`);
        
        await this.repository.update(reminderId, reminder.version + 1, {
          status: ReminderStatus.FAILED,
          nextExecutionAt: null,
          retryCount: nextRetryCount,
        });

        await this.repository.saveHistory(executionId, {
          reminderId,
          triggerSource,
          workerId,
          scheduledAt: reminder.nextExecutionAt || reminder.triggerTime,
          executedAt: new Date(),
          duration,
          result: ReminderStatus.FAILED,
          error: 'Max retries exceeded',
          retry: nextRetryCount,
        });

        await this.eventBus.publish(
          ReminderFailedEventPayload.eventName,
          new ReminderFailedEventPayload(reminderId, reminder.userId, new Date(), 'Max retries exceeded')
        );
      }
    }
  }

  private calculateNextRecurrence(frequency: string, lastDate: Date): Date {
    const next = new Date(lastDate);
    if (frequency === 'DAILY') {
      next.setDate(next.getDate() + 1);
    } else if (frequency === 'WEEKLY') {
      next.setDate(next.getDate() + 7);
    } else if (frequency === 'MONTHLY') {
      next.setMonth(next.getMonth() + 1);
    } else if (frequency === 'YEARLY') {
      next.setFullYear(next.getFullYear() + 1);
    } else {
      // Default fallback
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  private calculateBackoff(strategy: RetryStrategy, retryCount: number): number {
    if (strategy === RetryStrategy.LINEAR) {
      return retryCount * 5; // retry #1 -> 5s, #2 -> 10s...
    } else if (strategy === RetryStrategy.EXPONENTIAL) {
      return Math.pow(2, retryCount) * 5; // retry #1 -> 10s, #2 -> 20s...
    }
    return 5; // FIXED strategy: always 5 seconds
  }
}
