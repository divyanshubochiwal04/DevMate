import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { ReminderRepository } from '../repositories/reminder.repository';
import { IReminderExecutor } from '../interfaces/reminder-executor.interface';
import { IEventBus } from '../../telegram/interfaces/event-bus.interface';
import { CreateReminderDto } from '../dto/create-reminder.dto';
import { SnoozeReminderDto, SnoozeType } from '../dto/snooze-reminder.dto';
import { ReminderEntity, ReminderRuleEntity, ReminderHistoryEntity } from '../entities/reminder.entity';
import {
  ReminderCreatedEventPayload,
  ReminderUpdatedEventPayload,
  ReminderCancelledEventPayload,
  ReminderSnoozedEventPayload,
} from '../events/reminder-events';
import { ReminderStatus, ReminderType, ReminderFrequency, RetryStrategy } from '@prisma/client';
import { CustomLogger } from '../../common/logger/custom-logger.service';

@Injectable()
export class ReminderService {
  constructor(
    private readonly repository: ReminderRepository,
    @Inject(IReminderExecutor) private readonly executor: IReminderExecutor,
    @Inject(IEventBus) private readonly eventBus: IEventBus,
    private readonly logger: CustomLogger
  ) {
    this.logger.setContext('ReminderService');
  }

  async getReminderById(id: string): Promise<ReminderEntity> {
    const reminder = await this.repository.findById(id);
    if (!reminder) {
      throw new NotFoundException(`Reminder with ID ${id} not found`);
    }
    return this.mapToEntity(reminder);
  }

  async getRemindersByTarget(type: ReminderType, targetId: string): Promise<ReminderEntity[]> {
    const reminders = await this.repository.findByTarget(type, targetId);
    return reminders.map(r => this.mapToEntity(r));
  }

  async listReminders(userId: string): Promise<ReminderEntity[]> {
    const reminders = await this.repository.list(userId);
    return reminders.map(r => this.mapToEntity(r));
  }

  async createReminder(userId: string, dto: CreateReminderDto): Promise<ReminderEntity> {
    const triggerTime = new Date(dto.triggerTime);
    if (triggerTime.getTime() <= Date.now()) {
      throw new BadRequestException('Reminder trigger time must be in the future');
    }

    // RRULE validation placeholder
    if (dto.frequency === ReminderFrequency.RRULE && !dto.rrule) {
      throw new BadRequestException('Recurrence rule (rrule) is required when frequency is set to RRULE');
    }

    const data = {
      text: dto.text,
      type: dto.type,
      targetId: dto.targetId,
      targetType: dto.type,
      triggerTime,
      status: ReminderStatus.PENDING,
      nextExecutionAt: triggerTime,
      maxRetries: dto.maxRetries || 3,
      retryStrategy: dto.retryStrategy || RetryStrategy.FIXED,
      createdBy: userId,
    };

    const ruleData = dto.frequency
      ? {
          frequency: dto.frequency,
          rrule: dto.rrule,
          timezone: dto.timezone || 'UTC',
          startAt: dto.startAt ? new Date(dto.startAt) : undefined,
          endAt: dto.endAt ? new Date(dto.endAt) : undefined,
          maxOccurrences: dto.maxOccurrences,
        }
      : undefined;

    const reminder = await this.repository.create(userId, data, ruleData);
    const entity = this.mapToEntity(reminder);

    // Schedule task via Executor (Dependency Inverted)
    await this.executor.schedule(entity.id, entity.nextExecutionAt!);

    // Emit event
    await this.eventBus.publish(
      ReminderCreatedEventPayload.eventName,
      new ReminderCreatedEventPayload(entity.id, userId, entity.type, entity.triggerTime)
    );

    return entity;
  }

  async updateReminder(
    userId: string,
    id: string,
    dto: {
      text?: string;
      triggerTime?: string;
      version: number;
    }
  ): Promise<ReminderEntity> {
    const old = await this.repository.findById(id);
    if (!old) {
      throw new NotFoundException(`Reminder with ID ${id} not found`);
    }

    const updateData: any = {};
    if (dto.text) updateData.text = dto.text;
    if (dto.triggerTime) {
      const triggerTime = new Date(dto.triggerTime);
      if (triggerTime.getTime() <= Date.now()) {
        throw new BadRequestException('Reminder trigger time must be in the future');
      }
      updateData.triggerTime = triggerTime;
      updateData.nextExecutionAt = triggerTime;
    }

    const updated = await this.repository.update(id, dto.version, updateData);
    const entity = this.mapToEntity(updated);

    if (updateData.nextExecutionAt) {
      await this.executor.schedule(id, updateData.nextExecutionAt);
    }

    await this.eventBus.publish(
      ReminderUpdatedEventPayload.eventName,
      new ReminderUpdatedEventPayload(id, userId, entity.type, entity.nextExecutionAt)
    );

    return entity;
  }

  async cancelReminder(userId: string, id: string): Promise<ReminderEntity> {
    const reminder = await this.repository.findById(id);
    if (!reminder) {
      throw new NotFoundException(`Reminder with ID ${id} not found`);
    }

    await this.executor.cancel(id);
    const cancelled = await this.repository.cancel(id);
    const entity = this.mapToEntity(cancelled);

    await this.eventBus.publish(
      ReminderCancelledEventPayload.eventName,
      new ReminderCancelledEventPayload(id, userId, new Date())
    );

    return entity;
  }

  async resumeReminder(userId: string, id: string): Promise<ReminderEntity> {
    const reminder = await this.repository.findById(id);
    if (!reminder) {
      throw new NotFoundException(`Reminder with ID ${id} not found`);
    }

    let nextTime = reminder.nextExecutionAt || reminder.triggerTime;
    if (nextTime.getTime() <= Date.now()) {
      // If trigger time passed, default to now + 5 minutes
      nextTime = new Date(Date.now() + 300000);
    }

    const resumed = await this.repository.resume(id, nextTime);
    const entity = this.mapToEntity(resumed);

    await this.executor.schedule(id, nextTime);

    await this.eventBus.publish(
      ReminderUpdatedEventPayload.eventName,
      new ReminderUpdatedEventPayload(id, userId, entity.type, nextTime)
    );

    return entity;
  }

  async snoozeReminder(userId: string, id: string, dto: SnoozeReminderDto): Promise<ReminderEntity> {
    const reminder = await this.repository.findById(id);
    if (!reminder) {
      throw new NotFoundException(`Reminder with ID ${id} not found`);
    }

    let snoozedUntil: Date;
    const now = Date.now();

    switch (dto.snoozeType) {
      case SnoozeType.MIN_5:
        snoozedUntil = new Date(now + 5 * 60 * 1000);
        break;
      case SnoozeType.MIN_10:
        snoozedUntil = new Date(now + 10 * 60 * 1000);
        break;
      case SnoozeType.MIN_30:
        snoozedUntil = new Date(now + 30 * 60 * 1000);
        break;
      case SnoozeType.HOUR_1:
        snoozedUntil = new Date(now + 60 * 60 * 1000);
        break;
      case SnoozeType.TOMORROW:
        const tomorrow = new Date(now + 24 * 60 * 60 * 1000);
        tomorrow.setHours(9, 0, 0, 0); // Tomorrow at 9:00 AM
        snoozedUntil = tomorrow;
        break;
      case SnoozeType.CUSTOM:
        if (!dto.customDateTime) {
          throw new BadRequestException('customDateTime is required when snoozeType is CUSTOM');
        }
        snoozedUntil = new Date(dto.customDateTime);
        if (snoozedUntil.getTime() <= now) {
          throw new BadRequestException('Snooze trigger date must be in the future');
        }
        break;
      default:
        throw new BadRequestException('Invalid snoozeType option');
    }

    const snoozed = await this.repository.update(id, reminder.version, {
      status: ReminderStatus.SNOOZED,
      snoozedUntil,
      nextExecutionAt: snoozedUntil,
    });

    const entity = this.mapToEntity(snoozed);

    // Reschedule in execution engine
    await this.executor.schedule(id, snoozedUntil);

    await this.eventBus.publish(
      ReminderSnoozedEventPayload.eventName,
      new ReminderSnoozedEventPayload(id, userId, snoozedUntil)
    );

    return entity;
  }

  async getHistory(): Promise<ReminderHistoryEntity[]> {
    const list = await this.repository.getHistory();
    return list.map(
      h =>
        new ReminderHistoryEntity({
          id: h.id,
          executionId: h.executionId,
          triggerSource: h.triggerSource,
          workerId: h.workerId,
          scheduledAt: h.scheduledAt,
          executedAt: h.executedAt,
          duration: h.duration,
          result: h.result,
          error: h.error,
          retry: h.retry,
        })
    );
  }

  // ─── Mapper helper ───

  private mapToEntity(rem: any): ReminderEntity {
    return new ReminderEntity({
      id: rem.id,
      userId: rem.userId,
      text: rem.text,
      type: rem.type,
      targetId: rem.targetId,
      targetType: rem.targetType,
      triggerTime: rem.triggerTime,
      snoozeMinutes: rem.snoozeMinutes,
      snoozedUntil: rem.snoozedUntil,
      status: rem.status,
      nextExecutionAt: rem.nextExecutionAt,
      lastExecutedAt: rem.lastExecutedAt,
      retryCount: rem.retryCount,
      maxRetries: rem.maxRetries,
      retryStrategy: rem.retryStrategy,
      createdAt: rem.createdAt,
      updatedAt: rem.updatedAt,
      version: rem.version,
      rule: rem.rule
        ? new ReminderRuleEntity({
            id: rem.rule.id,
            frequency: rem.rule.frequency,
            rrule: rem.rule.rrule,
            timezone: rem.rule.timezone,
            startAt: rem.rule.startAt,
            endAt: rem.rule.endAt,
            occurrenceCount: rem.rule.occurrenceCount,
            maxOccurrences: rem.rule.maxOccurrences,
          })
        : null,
      history: rem.history
        ? rem.history.map(
            (h: any) =>
              new ReminderHistoryEntity({
                id: h.id,
                executionId: h.executionId,
                triggerSource: h.triggerSource,
                workerId: h.workerId,
                scheduledAt: h.scheduledAt,
                executedAt: h.executedAt,
                duration: h.duration,
                result: h.result,
                error: h.error,
                retry: h.retry,
              })
          )
        : [],
    });
  }
}
