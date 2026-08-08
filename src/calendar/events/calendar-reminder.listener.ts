import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { CalendarService } from '../services/calendar.service';
import { ReminderService } from '../../reminders/services/reminder.service';
import { EventRecurrenceService } from '../services/event-recurrence.service';
import {
  CalendarEventCreatedEventPayload,
  CalendarEventUpdatedEventPayload,
  CalendarEventRescheduledEventPayload,
  CalendarEventCancelledEventPayload,
  CalendarEventDeletedEventPayload
} from './calendar-events';
import { ReminderCompletedEventPayload } from '../../reminders/events/reminder-events';
import { ReminderType, ReminderStatus, ReminderFrequency, Prisma } from '@prisma/client';
import { CustomLogger } from '../../common/logger/custom-logger.service';
import { IEventHandler } from '../../events/interfaces/event-handler.interface';
import { EventHandlerRegistry } from '../../events/services/event-handler-registry.service';
import { IEventBus } from '../../telegram/interfaces/event-bus.interface';

@Injectable()
export class CalendarReminderListener implements OnModuleInit, IEventHandler {
  constructor(
    @Inject(forwardRef(() => CalendarService))
    private readonly calendarService: CalendarService,
    @Inject(forwardRef(() => ReminderService))
    private readonly reminderService: ReminderService,
    private readonly recurrenceService: EventRecurrenceService,
    private readonly registry: EventHandlerRegistry,
    private readonly logger: CustomLogger,
    @Inject(IEventBus) private readonly eventBus: IEventBus
  ) {
    this.logger.setContext('CalendarReminderListener');
  }

  onModuleInit() {
    this.logger.log('Registering CalendarReminderListener with EventHandlerRegistry...');
    this.registry.register(CalendarEventCreatedEventPayload.eventName, 'CalendarReminderConsumer', this);
    this.registry.register(CalendarEventUpdatedEventPayload.eventName, 'CalendarReminderConsumer', this);
    this.registry.register(CalendarEventRescheduledEventPayload.eventName, 'CalendarReminderConsumer', this);
    this.registry.register(CalendarEventCancelledEventPayload.eventName, 'CalendarReminderConsumer', this);
    this.registry.register(CalendarEventDeletedEventPayload.eventName, 'CalendarReminderConsumer', this);
    this.registry.register(ReminderCompletedEventPayload.eventName, 'CalendarReminderConsumer', this);

    this.eventBus.subscribe(ReminderCompletedEventPayload.eventName, (payload) => this.handle(payload, ReminderCompletedEventPayload.eventName).catch(err => this.logger.error(err)));
  }

  async handle(payload: any, eventName: string, tx?: Prisma.TransactionClient): Promise<void> {
    this.logger.log(`CalendarReminderConsumer handling event ${eventName} (Event ID: ${payload.eventId || payload.reminderId})`);

    if (
      eventName === CalendarEventCreatedEventPayload.eventName ||
      eventName === CalendarEventUpdatedEventPayload.eventName ||
      eventName === CalendarEventRescheduledEventPayload.eventName
    ) {
      await this.syncEventReminders(payload.userId, payload.eventId);
    } else if (
      eventName === CalendarEventCancelledEventPayload.eventName ||
      eventName === CalendarEventDeletedEventPayload.eventName
    ) {
      await this.cancelEventReminders(payload.userId, payload.eventId);
    } else if (eventName === ReminderCompletedEventPayload.eventName) {
      const reminder = await this.reminderService.getReminderById(payload.reminderId);
      if (reminder && reminder.type === ReminderType.EVENT && reminder.targetId) {
        this.logger.log(`Rolling calendar reminder progression check for event ${reminder.targetId}`);
        await this.syncEventReminders(payload.userId, reminder.targetId);
      }
    }
  }

  /**
   * Idempotently cancels all pending Scheduled/Pending reminders for an event.
   */
  async cancelEventReminders(userId: string, eventId: string) {
    const activeReminders = await this.reminderService.getRemindersByTarget(ReminderType.EVENT, eventId);
    for (const rem of activeReminders) {
      if (rem.status === ReminderStatus.PENDING || rem.status === ReminderStatus.SCHEDULED) {
        this.logger.log(`Cancelling pending reminder ${rem.id} for event ${eventId}`);
        await this.reminderService.cancelReminder(userId, rem.id).catch(err => {
          this.logger.error(`Failed to cancel reminder ${rem.id}: ${err.message}`);
        });
      }
    }
  }

  /**
   * Syncs rolling reminders for an event by finding the immediate next occurrence,
   * calculating the trigger times, and scheduling only those reminders.
   */
  async syncEventReminders(userId: string, eventId: string) {
    // 1. Cancel previous pending reminders to maintain idempotency
    await this.cancelEventReminders(userId, eventId);

    // 2. Fetch event details
    const event = await this.calendarService.getEventById(userId, eventId);
    if (event.deletedAt || event.status === 'CANCELLED' || event.status === 'COMPLETED') {
      return;
    }

    // 3. Find the immediate next future occurrence
    const now = new Date();
    const from = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes back to catch immediate overlaps
    const to = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // look ahead up to 60 days

    const occurrences = this.recurrenceService.generateOccurrences(
      event.startAt,
      event.endAt,
      event.recurrenceFrequency,
      event.timezone,
      from,
      to,
      {
        rrule: event.rrule || undefined,
        recurrenceEndAt: event.recurrenceEndAt || undefined,
        recurrenceCount: event.recurrenceCount || undefined,
      }
    );

    // Filter out occurrences with CANCELLED exceptions
    const activeOccurrences = occurrences.filter(occ => {
      const exc = event.recurrenceExceptions.find(
        ex => ex.originalOccurrenceAt.getTime() === occ.startAt.getTime()
      );
      return !exc || exc.type !== 'CANCELLED';
    });

    if (activeOccurrences.length === 0) {
      this.logger.log(`No future active occurrences found for event ${eventId}. Skipping reminder sync.`);
      return;
    }

    // Pick the first upcoming occurrence starting in the future
    const nextOcc = activeOccurrences.find(occ => occ.startAt > now) || activeOccurrences[0];

    // If even the first occurrence has already started/passed, skip
    if (nextOcc.startAt <= now) {
      return;
    }

    // 4. Schedule reminders for this next occurrence
    for (const calRem of event.reminders) {
      const triggerTime = new Date(nextOcc.startAt.getTime() - calRem.offsetMinutes * 60 * 1000);

      // Only schedule if trigger time is in the future
      if (triggerTime > now) {
        this.logger.log(`Scheduling rolling reminder for event ${eventId} (occurrence: ${nextOcc.startAt.toISOString()}) at ${triggerTime.toISOString()}`);
        await this.reminderService.createReminder(userId, {
          text: `Reminder: Event "${event.title}" starts soon!`,
          type: ReminderType.EVENT,
          targetId: eventId,
          triggerTime: triggerTime.toISOString(),
          frequency: ReminderFrequency.ONETIME,
        }).catch(err => {
          this.logger.error(`Failed to create reminder: ${err.message}`);
        });
      }
    }
  }
}
