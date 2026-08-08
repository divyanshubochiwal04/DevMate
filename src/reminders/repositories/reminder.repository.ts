import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Reminder, ReminderStatus, ReminderType, ReminderFrequency, RetryStrategy } from '@prisma/client';

@Injectable()
export class ReminderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.reminder.findUnique({
      where: { id },
      include: {
        rule: true,
        history: true,
      },
    });
  }

  async findByTarget(type: ReminderType, targetId: string) {
    return this.prisma.reminder.findMany({
      where: { type, targetId },
      include: {
        rule: true,
        history: true,
      },
    });
  }

  async list(userId: string) {
    return this.prisma.reminder.findMany({
      where: { userId },
      include: {
        rule: true,
        history: true,
      },
    });
  }

  async create(
    userId: string,
    data: {
      text: string;
      type: ReminderType;
      targetId?: string;
      targetType?: ReminderType;
      triggerTime: Date;
      status: ReminderStatus;
      nextExecutionAt: Date;
      maxRetries: number;
      retryStrategy: RetryStrategy;
      createdBy?: string;
    },
    ruleData?: {
      frequency: ReminderFrequency;
      rrule?: string;
      timezone: string;
      startAt?: Date;
      endAt?: Date;
      maxOccurrences?: number;
    }
  ) {
    return this.prisma.$transaction(async (tx) => {
      const reminder = await tx.reminder.create({
        data: {
          ...data,
          userId,
          version: 1,
        },
      });

      if (ruleData) {
        await tx.reminderRule.create({
          data: {
            reminderId: reminder.id,
            frequency: ruleData.frequency,
            rrule: ruleData.rrule,
            timezone: ruleData.timezone,
            startAt: ruleData.startAt,
            endAt: ruleData.endAt,
            maxOccurrences: ruleData.maxOccurrences,
          },
        });
      }

      return tx.reminder.findUnique({
        where: { id: reminder.id },
        include: {
          rule: true,
          history: true,
        },
      });
    });
  }

  async update(
    id: string,
    currentVersion: number,
    data: {
      text?: string;
      triggerTime?: Date;
      snoozedUntil?: Date | null;
      status?: ReminderStatus;
      nextExecutionAt?: Date | null;
      lastExecutedAt?: Date | null;
      retryCount?: number;
      updatedBy?: string;
    },
    ruleData?: {
      frequency?: ReminderFrequency;
      rrule?: string;
      timezone?: string;
      startAt?: Date;
      endAt?: Date;
      maxOccurrences?: number;
      occurrenceCount?: number;
    }
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Optimistic Concurrency Control check
      const result = await tx.reminder.updateMany({
        where: { id, version: currentVersion },
        data: {
          ...data,
          version: currentVersion + 1,
        },
      });

      if (result.count === 0) {
        throw new ConflictException('Optimistic concurrency lock failed: Reminder was updated by another request.');
      }

      // 2. Update Rule if needed
      if (ruleData) {
        await tx.reminderRule.update({
          where: { reminderId: id },
          data: {
            frequency: ruleData.frequency,
            rrule: ruleData.rrule,
            timezone: ruleData.timezone,
            startAt: ruleData.startAt,
            endAt: ruleData.endAt,
            maxOccurrences: ruleData.maxOccurrences,
            occurrenceCount: ruleData.occurrenceCount,
          },
        });
      }

      return tx.reminder.findUnique({
        where: { id },
        include: {
          rule: true,
          history: true,
        },
      });
    });
  }

  async delete(id: string) {
    return this.prisma.reminder.delete({
      where: { id },
    });
  }

  async cancel(id: string) {
    return this.prisma.reminder.update({
      where: { id },
      data: {
        status: ReminderStatus.CANCELLED,
        nextExecutionAt: null,
      },
    });
  }

  async resume(id: string, nextExecutionAt: Date) {
    return this.prisma.reminder.update({
      where: { id },
      data: {
        status: ReminderStatus.SCHEDULED,
        nextExecutionAt,
      },
    });
  }

  async findHistoryByExecutionId(executionId: string) {
    return this.prisma.reminderHistory.findFirst({
      where: { executionId },
    });
  }

  async saveHistory(
    executionId: string,
    data: {
      reminderId: string;
      triggerSource: string;
      workerId?: string;
      scheduledAt: Date;
      executedAt: Date;
      duration: number;
      result: ReminderStatus;
      error?: string;
      retry: number;
    }
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Idempotency: verify if this executionId was already logged
      const existing = await tx.reminderHistory.findFirst({
        where: { executionId },
      });

      if (existing) {
        // Idempotent return
        return existing;
      }

      return tx.reminderHistory.create({
        data: {
          executionId,
          reminderId: data.reminderId,
          triggerSource: data.triggerSource,
          workerId: data.workerId,
          scheduledAt: data.scheduledAt,
          executedAt: data.executedAt,
          duration: data.duration,
          result: data.result,
          error: data.error,
          retry: data.retry,
        },
      });
    });
  }

  async getHistory() {
    return this.prisma.reminderHistory.findMany({
      orderBy: { executedAt: 'desc' },
      include: {
        reminder: true,
      },
    });
  }
}
