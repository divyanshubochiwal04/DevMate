import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import { CalendarRepository } from '../repositories/calendar.repository';
import { EventRecurrenceService } from './event-recurrence.service';
import { EventConflictService } from './event-conflict.service';
import { NotesService } from '../../notes/services/notes.service';
import { TodoService } from '../../todo/services/todo.service';
import { VaultService } from '../../vault/services/vault.service';
import { IEventBus } from '../../telegram/interfaces/event-bus.interface';
import { CalendarType, EventType, EventStatus, RecurrenceFrequency, AttendeeStatus, FileStatus } from '@prisma/client';
import { CreateCalendarDto, UpdateCalendarDto } from '../dto/calendar.dto';
import { CreateEventDto, UpdateEventDto, RescheduleEventDto, ModifyOccurrenceDto, CreateAttendeeDto, UpdateAttendeeDto } from '../dto/event.dto';
import {
  CalendarCreatedEventPayload,
  CalendarUpdatedEventPayload,
  CalendarDeletedEventPayload,
  CalendarEventCreatedEventPayload,
  CalendarEventUpdatedEventPayload,
  CalendarEventRescheduledEventPayload,
  CalendarEventCancelledEventPayload,
  CalendarEventCompletedEventPayload,
  CalendarEventDeletedEventPayload,
  EventAttendeeAddedEventPayload,
  EventAttendeeRemovedEventPayload,
  EventReminderAddedEventPayload,
  EventReminderRemovedEventPayload
} from '../events/calendar-events';

import { OutboxService } from '../../events/services/outbox.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CalendarService {
  constructor(
    private readonly repository: CalendarRepository,
    private readonly recurrenceService: EventRecurrenceService,
    @Inject(forwardRef(() => EventConflictService))
    private readonly conflictService: EventConflictService,
    @Inject(forwardRef(() => NotesService))
    private readonly notesService: NotesService,
    @Inject(forwardRef(() => TodoService))
    private readonly todoService: TodoService,
    @Inject(forwardRef(() => VaultService))
    private readonly vaultService: VaultService,
    @Inject(IEventBus) private readonly eventBus: IEventBus,
    private readonly outboxService: OutboxService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Automatically initializes a default calendar for the user if they don't have one.
   */
  async ensureDefaultCalendarExists(userId: string): Promise<any> {
    let defCalendar = await this.repository.findDefaultCalendar(userId);
    if (!defCalendar) {
      const calendars = await this.repository.listCalendars(userId);
      if (calendars.length === 0) {
        defCalendar = await this.repository.createCalendar(userId, {
          name: 'Personal Calendar',
          type: CalendarType.PERSONAL,
          timezone: 'UTC',
          isDefault: true,
          isVisible: true,
          sortOrder: 0,
        });
        await this.eventBus.publish(
          CalendarCreatedEventPayload.eventName,
          new CalendarCreatedEventPayload(defCalendar.id, userId, defCalendar.name)
        ).catch(err => console.error(`Failed to publish CalendarCreated: ${err.message}`));
      } else {
        // If they have calendars but no default, mark the first one as default
        defCalendar = await this.repository.updateCalendar(calendars[0].id, userId, calendars[0].version, {
          isDefault: true,
        });
      }
    }
    return defCalendar;
  }

  // ─── Calendars CRUD ───

  async createCalendar(userId: string, dto: CreateCalendarDto) {
    // Enforce name uniqueness per user
    const existing = await this.repository.listCalendars(userId);
    if (existing.some(c => c.name.toLowerCase() === dto.name.toLowerCase())) {
      throw new BadRequestException(`Calendar with name "${dto.name}" already exists.`);
    }

    const calendar = await this.repository.createCalendar(userId, dto);
    await this.eventBus.publish(
      CalendarCreatedEventPayload.eventName,
      new CalendarCreatedEventPayload(calendar.id, userId, calendar.name)
    ).catch(err => console.error(`Failed to publish CalendarCreated: ${err.message}`));

    return calendar;
  }

  async getCalendarById(userId: string, id: string) {
    await this.ensureDefaultCalendarExists(userId);
    const calendar = await this.repository.findCalendarById(id, userId);
    if (!calendar) {
      throw new NotFoundException(`Calendar with ID ${id} not found.`);
    }
    return calendar;
  }

  async listCalendars(userId: string) {
    await this.ensureDefaultCalendarExists(userId);
    return this.repository.listCalendars(userId);
  }

  async updateCalendar(userId: string, id: string, dto: UpdateCalendarDto) {
    // Verify existence
    const calendar = await this.getCalendarById(userId, id);

    // Enforce name uniqueness if name is changed
    if (dto.name && dto.name.toLowerCase() !== calendar.name.toLowerCase()) {
      const existing = await this.repository.listCalendars(userId);
      if (existing.some(c => c.name.toLowerCase() === dto.name!.toLowerCase() && c.id !== id)) {
        throw new BadRequestException(`Calendar with name "${dto.name}" already exists.`);
      }
    }

    const updated = await this.repository.updateCalendar(id, userId, dto.version, dto);
    await this.eventBus.publish(
      CalendarUpdatedEventPayload.eventName,
      new CalendarUpdatedEventPayload(id, userId, updated!.version)
    ).catch(err => console.error(`Failed to publish CalendarUpdated: ${err.message}`));

    return updated;
  }

  async deleteCalendar(userId: string, id: string, version: number) {
    const calendar = await this.getCalendarById(userId, id);

    if (calendar.isDefault) {
      throw new BadRequestException('Cannot delete default calendar unless another calendar is set as default first.');
    }

    const deleted = await this.repository.updateCalendar(id, userId, version, {
      deletedAt: new Date(),
    });

    await this.eventBus.publish(
      CalendarDeletedEventPayload.eventName,
      new CalendarDeletedEventPayload(id, userId)
    ).catch(err => console.error(`Failed to publish CalendarDeleted: ${err.message}`));

    return deleted;
  }

  async setDefaultCalendar(userId: string, id: string, version: number) {
    await this.getCalendarById(userId, id);
    const updated = await this.repository.setDefaultCalendarAtomic(id, userId, version);

    await this.eventBus.publish(
      CalendarUpdatedEventPayload.eventName,
      new CalendarUpdatedEventPayload(id, userId, updated!.version)
    ).catch(err => console.error(`Failed to publish CalendarUpdated: ${err.message}`));

    return updated;
  }

  // ─── Events CRUD ───

  async createEvent(userId: string, dto: CreateEventDto) {
    await this.ensureDefaultCalendarExists(userId);
    
    // 1. Verify calendar exists and belongs to the user
    const calendar = await this.getCalendarById(userId, dto.calendarId);

    // 2. Validate timestamps
    const start = new Date(dto.startAt);
    const end = new Date(dto.endAt);

    // 3. Normalize all-day event
    let timezone = dto.timezone || calendar.timezone || 'UTC';
    let isAllDay = dto.isAllDay || false;
    let finalStart = start;
    let finalEnd = end;

    if (isAllDay) {
      // Extract UTC components of the input Dates to bypass any local time offsets
      const startYear = start.getUTCFullYear();
      const startMonth = start.getUTCMonth();
      const startDay = start.getUTCDate();

      let endYear = end.getUTCFullYear();
      let endMonth = end.getUTCMonth();
      let endDay = end.getUTCDate();

      // If start and end are on the same day, force exclusive end to the next calendar day
      if (startYear === endYear && startMonth === endMonth && startDay === endDay) {
        const nextDay = new Date(Date.UTC(endYear, endMonth, endDay + 1));
        endYear = nextDay.getUTCFullYear();
        endMonth = nextDay.getUTCMonth();
        endDay = nextDay.getUTCDate();
      }

      finalStart = this.recurrenceService.localToUtc(startYear, startMonth, startDay, 0, 0, 0, timezone);
      finalEnd = this.recurrenceService.localToUtc(endYear, endMonth, endDay, 0, 0, 0, timezone);
    } else {
      if (end <= start) {
        throw new BadRequestException('Event end time (endAt) must be strictly after start time (startAt).');
      }
    }

    // 4. Validate external references through public service boundaries
    if (dto.todoId) {
      await this.todoService.validateTodoOwnership(dto.todoId, userId);
    }
    if (dto.noteId) {
      await this.notesService.validateNoteOwnership(dto.noteId, userId);
    }
    if (dto.attachments) {
      for (const fileId of dto.attachments) {
        const file = await this.vaultService.getFileMetadata(userId, fileId);
        if (file.status !== FileStatus.READY || file.deletedAt !== null) {
          throw new BadRequestException(`Vault file with ID ${fileId} is not valid or ready for attachment.`);
        }
      }
    }

    // 5. Conflict warning check (does not reject creation)
    const { hasConflict, conflictingEvents } = await this.conflictService.checkConflicts(
      userId,
      dto.calendarId,
      finalStart,
      finalEnd,
      dto.recurrenceFrequency || RecurrenceFrequency.NONE,
      {
        rrule: dto.rrule,
        recurrenceEndAt: dto.recurrenceEndAt ? new Date(dto.recurrenceEndAt) : undefined,
        recurrenceCount: dto.recurrenceCount,
      }
    );

    if (hasConflict) {
      console.warn(`[CalendarService] Warning: overlapping timed events detected in calendar ${dto.calendarId} for user ${userId}. Conflicting events:`, conflictingEvents.map(e => e.id));
    }

    return this.prisma.$transaction(async (tx) => {
      // 6. DB operations
      const event = await this.repository.createEvent(
        userId,
        dto.calendarId,
        {
          title: dto.title,
          description: dto.description,
          startAt: finalStart,
          endAt: finalEnd,
          timezone,
          isAllDay,
          type: dto.type || EventType.EVENT,
          status: dto.status || EventStatus.SCHEDULED,
          locationName: dto.locationName,
          locationAddress: dto.locationAddress,
          latitude: dto.latitude,
          longitude: dto.longitude,
          meetingUrl: dto.meetingUrl,
          recurrenceFrequency: dto.recurrenceFrequency || RecurrenceFrequency.NONE,
          rrule: dto.rrule,
          recurrenceEndAt: dto.recurrenceEndAt ? new Date(dto.recurrenceEndAt) : undefined,
          recurrenceCount: dto.recurrenceCount,
          todoId: dto.todoId,
          noteId: dto.noteId,
          createdBy: userId,
        },
        {
          reminders: dto.reminders,
          attendees: dto.attendees,
          attachments: dto.attachments,
        },
        tx
      );

      // 7. Publish Domain Event
      await this.outboxService.publish({
        eventName: CalendarEventCreatedEventPayload.eventName,
        aggregateType: 'CalendarEvent',
        aggregateId: event!.id,
        userId,
        payload: new CalendarEventCreatedEventPayload(event!.id, userId, event!.title)
      }, tx);

      return event;
    });
  }

  async getEventById(userId: string, id: string) {
    await this.ensureDefaultCalendarExists(userId);
    const event = await this.repository.findEventById(id, userId);
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found.`);
    }
    return event;
  }

  async listEvents(
    userId: string,
    filters: {
      calendarId?: string;
      type?: EventType;
      status?: EventStatus;
      search?: string;
      hasReminder?: boolean;
      hasAttendees?: boolean;
      from: string;
      to: string;
      page?: number;
      limit?: number;
    }
  ) {
    await this.ensureDefaultCalendarExists(userId);
    const fromDate = new Date(filters.from);
    const toDate = new Date(filters.to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid query date thresholds (from/to).');
    }

    let targetCalendarId = filters.calendarId;
    if (!targetCalendarId) {
      const defCal = await this.ensureDefaultCalendarExists(userId);
      targetCalendarId = defCal.id;
    }

    // Load matching events starting before 'to'
    const events = await this.repository.findEventsByCalendar(targetCalendarId!, fromDate, toDate);

    // Filter by type / status / search in application layer where it's mixed with recurrence
    let filteredEvents = events;
    if (filters.type) filteredEvents = filteredEvents.filter(e => e.type === filters.type);
    if (filters.status) filteredEvents = filteredEvents.filter(e => e.status === filters.status);
    if (filters.search) {
      const searchStr = filters.search.toLowerCase();
      filteredEvents = filteredEvents.filter(
        e => e.title.toLowerCase().includes(searchStr) || e.description?.toLowerCase().includes(searchStr)
      );
    }
    if (filters.hasReminder) {
      filteredEvents = filteredEvents.filter(e => e.reminders.length > 0);
    }
    if (filters.hasAttendees) {
      filteredEvents = filteredEvents.filter(e => e.attendees.length > 0);
    }

    const allOccurrences: any[] = [];

    // Generate occurrences
    for (const event of filteredEvents) {
      const occurrences = this.recurrenceService.generateOccurrences(
        event.startAt,
        event.endAt,
        event.recurrenceFrequency,
        event.timezone,
        fromDate,
        toDate,
        {
          rrule: event.rrule || undefined,
          recurrenceEndAt: event.recurrenceEndAt || undefined,
          recurrenceCount: event.recurrenceCount || undefined,
        }
      );

      for (const occ of occurrences) {
        // Resolve exceptions
        const exc = event.recurrenceExceptions.find(
          ex => ex.originalOccurrenceAt.getTime() === occ.startAt.getTime()
        );

        if (exc) {
          if (exc.type === 'CANCELLED') {
            continue; // Skip cancelled occurrences
          } else if (exc.type === 'MODIFIED') {
            const override = exc.overrideData as any;
            const modifiedOcc = {
              ...event,
              id: `${event.id}_${occ.startAt.toISOString()}`,
              seriesId: event.id,
              isOccurrenceOverride: true,
              originalOccurrenceAt: occ.startAt,
              title: override.title || event.title,
              description: override.description !== undefined ? override.description : event.description,
              startAt: override.startAt ? new Date(override.startAt) : occ.startAt,
              endAt: override.endAt ? new Date(override.endAt) : occ.endAt,
              status: override.status || event.status,
            };
            if (modifiedOcc.startAt <= toDate && modifiedOcc.endAt >= fromDate) {
              allOccurrences.push(modifiedOcc);
            }
          }
        } else {
          // Regular occurrence
          allOccurrences.push({
            ...event,
            startAt: occ.startAt,
            endAt: occ.endAt,
          });
        }
      }
    }

    // Apply pagination
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;
    const paginated = allOccurrences.slice(skip, skip + limit);

    return {
      items: paginated,
      totalCount: allOccurrences.length,
      page,
      limit,
    };
  }

  async updateEvent(userId: string, id: string, dto: UpdateEventDto) {
    const event = await this.getEventById(userId, id);

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.locationName !== undefined) updateData.locationName = dto.locationName;
    if (dto.locationAddress !== undefined) updateData.locationAddress = dto.locationAddress;
    if (dto.latitude !== undefined) updateData.latitude = dto.latitude;
    if (dto.longitude !== undefined) updateData.longitude = dto.longitude;
    if (dto.meetingUrl !== undefined) updateData.meetingUrl = dto.meetingUrl;
    if (dto.recurrenceFrequency !== undefined) updateData.recurrenceFrequency = dto.recurrenceFrequency;
    if (dto.rrule !== undefined) updateData.rrule = dto.rrule;
    if (dto.recurrenceEndAt !== undefined) {
      updateData.recurrenceEndAt = dto.recurrenceEndAt ? new Date(dto.recurrenceEndAt) : null;
    }
    if (dto.recurrenceCount !== undefined) updateData.recurrenceCount = dto.recurrenceCount;

    const isAllDay = dto.isAllDay !== undefined ? dto.isAllDay : event.isAllDay;
    let timezone = dto.timezone !== undefined ? dto.timezone : event.timezone;

    if (dto.startAt || dto.endAt || dto.isAllDay !== undefined || dto.timezone !== undefined) {
      let start = event.startAt;
      let end = event.endAt;
      const originalDuration = end.getTime() - start.getTime();

      if (dto.startAt && dto.endAt) {
        start = new Date(dto.startAt);
        end = new Date(dto.endAt);
      } else if (dto.startAt) {
        start = new Date(dto.startAt);
        end = new Date(start.getTime() + originalDuration);
      } else if (dto.endAt) {
        end = new Date(dto.endAt);
        if (end.getTime() - start.getTime() <= 0) {
          start = new Date(end.getTime() - originalDuration);
        }
      }

      if (isAllDay) {
        const tz = timezone || 'UTC';
        // Extract UTC components of the Dates to bypass any local shifts during ingestion
        const startYear = start.getUTCFullYear();
        const startMonth = start.getUTCMonth();
        const startDay = start.getUTCDate();
        
        let endYear = end.getUTCFullYear();
        let endMonth = end.getUTCMonth();
        let endDay = end.getUTCDate();
        
        // If start and end are on the same day, force exclusive end to the next calendar day
        if (startYear === endYear && startMonth === endMonth && startDay === endDay) {
          const nextDay = new Date(Date.UTC(endYear, endMonth, endDay + 1));
          endYear = nextDay.getUTCFullYear();
          endMonth = nextDay.getUTCMonth();
          endDay = nextDay.getUTCDate();
        }

        start = this.recurrenceService.localToUtc(startYear, startMonth, startDay, 0, 0, 0, tz);
        end = this.recurrenceService.localToUtc(endYear, endMonth, endDay, 0, 0, 0, tz);
        timezone = tz;
      } else {
        if (end <= start) {
          throw new BadRequestException('Event end time (endAt) must be strictly after start time (startAt).');
        }
      }

      updateData.startAt = start;
      updateData.endAt = end;
      updateData.isAllDay = isAllDay;
      updateData.timezone = timezone;
    }

    // Validate external boundaries
    if (dto.todoId !== undefined) {
      if (dto.todoId) {
        await this.todoService.validateTodoOwnership(dto.todoId, userId);
      }
      updateData.todoId = dto.todoId;
    }
    if (dto.noteId !== undefined) {
      if (dto.noteId) {
        await this.notesService.validateNoteOwnership(dto.noteId, userId);
      }
      updateData.noteId = dto.noteId;
    }
    if (dto.attachments !== undefined) {
      if (dto.attachments) {
        for (const fileId of dto.attachments) {
          const file = await this.vaultService.getFileMetadata(userId, fileId);
          if (file.status !== FileStatus.READY || file.deletedAt !== null) {
            throw new BadRequestException(`Vault file with ID ${fileId} is not valid.`);
          }
        }
      }
    }

    const relations: any = {};
    if (dto.reminders !== undefined) relations.reminders = dto.reminders;
    if (dto.attendees !== undefined) relations.attendees = dto.attendees;
    if (dto.attachments !== undefined) relations.attachments = dto.attachments;

    const oldStart = event.startAt;
    const oldEnd = event.endAt;

    return this.prisma.$transaction(async (tx) => {
      const updated = await this.repository.updateEvent(id, userId, dto.version, updateData, relations, tx);

      // Emit rescheduled event if timestamps shifted
      if (updateData.startAt || updateData.endAt) {
        await this.outboxService.publish({
          eventName: CalendarEventRescheduledEventPayload.eventName,
          aggregateType: 'CalendarEvent',
          aggregateId: id,
          userId,
          payload: new CalendarEventRescheduledEventPayload(id, userId, oldStart, oldEnd, updated!.startAt, updated!.endAt),
        }, tx);
      }

      // Emit standard updated event
      await this.outboxService.publish({
        eventName: CalendarEventUpdatedEventPayload.eventName,
        aggregateType: 'CalendarEvent',
        aggregateId: id,
        userId,
        payload: new CalendarEventUpdatedEventPayload(id, userId, updated!.version),
      }, tx);

      return updated;
    });
  }

  async deleteEvent(userId: string, id: string, version: number) {
    await this.getEventById(userId, id);

    return this.prisma.$transaction(async (tx) => {
      const deleted = await this.repository.updateEvent(id, userId, version, {
        deletedAt: new Date(),
      }, undefined, tx);

      await this.outboxService.publish({
        eventName: CalendarEventDeletedEventPayload.eventName,
        aggregateType: 'CalendarEvent',
        aggregateId: id,
        userId,
        payload: new CalendarEventDeletedEventPayload(id, userId),
      }, tx);

      return deleted;
    });
  }

  async cancelEvent(userId: string, id: string, version: number) {
    await this.getEventById(userId, id);

    return this.prisma.$transaction(async (tx) => {
      const cancelled = await this.repository.updateEvent(id, userId, version, {
        status: EventStatus.CANCELLED,
        cancelledAt: new Date(),
      }, undefined, tx);

      await this.outboxService.publish({
        eventName: CalendarEventCancelledEventPayload.eventName,
        aggregateType: 'CalendarEvent',
        aggregateId: id,
        userId,
        payload: new CalendarEventCancelledEventPayload(id, userId),
      }, tx);

      return cancelled;
    });
  }

  async completeEvent(userId: string, id: string, version: number) {
    await this.getEventById(userId, id);

    return this.prisma.$transaction(async (tx) => {
      const completed = await this.repository.updateEvent(id, userId, version, {
        status: EventStatus.COMPLETED,
        completedAt: new Date(),
      }, undefined, tx);

      await this.outboxService.publish({
        eventName: CalendarEventCompletedEventPayload.eventName,
        aggregateType: 'CalendarEvent',
        aggregateId: id,
        userId,
        payload: new CalendarEventCompletedEventPayload(id, userId),
      }, tx);

      return completed;
    });
  }

  async rescheduleEvent(userId: string, id: string, dto: RescheduleEventDto) {
    const event = await this.getEventById(userId, id);

    const start = new Date(dto.startAt);
    const end = new Date(dto.endAt);
    if (end <= start) {
      throw new BadRequestException('Event end time (endAt) must be strictly after start time (startAt).');
    }

    const oldStart = event.startAt;
    const oldEnd = event.endAt;

    return this.prisma.$transaction(async (tx) => {
      const updated = await this.repository.updateEvent(id, userId, dto.version, {
        startAt: start,
        endAt: end,
      }, undefined, tx);

      await this.outboxService.publish({
        eventName: CalendarEventRescheduledEventPayload.eventName,
        aggregateType: 'CalendarEvent',
        aggregateId: id,
        userId,
        payload: new CalendarEventRescheduledEventPayload(id, userId, oldStart, oldEnd, start, end),
      }, tx);

      await this.outboxService.publish({
        eventName: CalendarEventUpdatedEventPayload.eventName,
        aggregateType: 'CalendarEvent',
        aggregateId: id,
        userId,
        payload: new CalendarEventUpdatedEventPayload(id, userId, updated!.version),
      }, tx);

      return updated;
    });
  }

  // ─── Recurrence Exceptions ───

  async modifyOccurrence(userId: string, eventId: string, occurrenceDate: Date, dto: ModifyOccurrenceDto) {
    const event = await this.getEventById(userId, eventId);
    if (event.recurrenceFrequency === RecurrenceFrequency.NONE) {
      throw new BadRequestException('Cannot modify single occurrence of a non-recurring event.');
    }

    // Strong DTO Validation
    const overrideData: any = {};
    if (dto.title !== undefined) overrideData.title = dto.title;
    if (dto.description !== undefined) overrideData.description = dto.description;
    if (dto.status !== undefined) overrideData.status = dto.status;
    if (dto.startAt !== undefined) overrideData.startAt = new Date(dto.startAt).toISOString();
    if (dto.endAt !== undefined) overrideData.endAt = new Date(dto.endAt).toISOString();

    // Check if exception already exists
    await this.repository.deleteRecurrenceException(eventId, occurrenceDate);

    await this.repository.createRecurrenceException({
      eventId,
      originalOccurrenceAt: occurrenceDate,
      type: 'MODIFIED',
      overrideData,
    });

    const updatedEvent = await this.getEventById(userId, eventId);
    await this.eventBus.publish(
      CalendarEventUpdatedEventPayload.eventName,
      new CalendarEventUpdatedEventPayload(eventId, userId, updatedEvent.version)
    ).catch(err => console.error(`Failed to publish CalendarEventUpdated: ${err.message}`));

    return updatedEvent;
  }

  async cancelOccurrence(userId: string, eventId: string, occurrenceDate: Date) {
    const event = await this.getEventById(userId, eventId);
    if (event.recurrenceFrequency === RecurrenceFrequency.NONE) {
      throw new BadRequestException('Cannot cancel single occurrence of a non-recurring event.');
    }

    // Check if exception already exists
    await this.repository.deleteRecurrenceException(eventId, occurrenceDate);

    await this.repository.createRecurrenceException({
      eventId,
      originalOccurrenceAt: occurrenceDate,
      type: 'CANCELLED',
    });

    const updatedEvent = await this.getEventById(userId, eventId);
    await this.eventBus.publish(
      CalendarEventUpdatedEventPayload.eventName,
      new CalendarEventUpdatedEventPayload(eventId, userId, updatedEvent.version)
    ).catch(err => console.error(`Failed to publish CalendarEventUpdated: ${err.message}`));

    return updatedEvent;
  }

  // ─── Sub-Resource Actions (IDOR Safe) ───

  async addAttendee(userId: string, eventId: string, dto: CreateAttendeeDto) {
    const event = await this.getEventById(userId, eventId);

    // Prevent duplicates
    const activeAttendees = event.attendees;
    if (activeAttendees.some(a => a.email && a.email.toLowerCase() === dto.email?.toLowerCase())) {
      throw new BadRequestException('Attendee email is already added to this event.');
    }
    if (dto.userId && activeAttendees.some(a => a.userId === dto.userId)) {
      throw new BadRequestException('Attendee user is already added to this event.');
    }
    if (dto.userId === userId) {
      throw new BadRequestException('Event owner cannot be added as a duplicate attendee.');
    }

    const attendee = await this.repository.createAttendee(eventId, dto);
    await this.eventBus.publish(
      EventAttendeeAddedEventPayload.eventName,
      new EventAttendeeAddedEventPayload(eventId, userId, attendee.id, attendee.name)
    ).catch(err => console.error(`Failed to publish EventAttendeeAdded: ${err.message}`));

    return attendee;
  }

  async updateAttendee(userId: string, eventId: string, attendeeId: string, dto: UpdateAttendeeDto) {
    const event = await this.getEventById(userId, eventId);
    const attendee = event.attendees.find(a => a.id === attendeeId);
    if (!attendee) {
      throw new NotFoundException(`Attendee with ID ${attendeeId} not found in this event.`);
    }

    return this.repository.updateAttendee(attendeeId, eventId, dto);
  }

  async deleteAttendee(userId: string, eventId: string, attendeeId: string) {
    const event = await this.getEventById(userId, eventId);
    const attendee = event.attendees.find(a => a.id === attendeeId);
    if (!attendee) {
      throw new NotFoundException(`Attendee with ID ${attendeeId} not found in this event.`);
    }

    await this.repository.deleteAttendee(attendeeId, eventId);
    await this.eventBus.publish(
      EventAttendeeRemovedEventPayload.eventName,
      new EventAttendeeRemovedEventPayload(eventId, userId, attendeeId)
    ).catch(err => console.error(`Failed to publish EventAttendeeRemoved: ${err.message}`));
  }

  async addReminder(userId: string, eventId: string, offsetMinutes: number) {
    const event = await this.getEventById(userId, eventId);

    // Prevent duplicates
    if (event.reminders.some(r => r.offsetMinutes === offsetMinutes)) {
      throw new BadRequestException('Reminder offset already exists for this event.');
    }

    const triggerTime = new Date(event.startAt.getTime() - offsetMinutes * 60 * 1000);
    const reminder = await this.repository.createCalendarReminder(eventId, offsetMinutes, triggerTime);

    await this.eventBus.publish(
      EventReminderAddedEventPayload.eventName,
      new EventReminderAddedEventPayload(eventId, userId, reminder.id, offsetMinutes)
    ).catch(err => console.error(`Failed to publish EventReminderAdded: ${err.message}`));

    return reminder;
  }

  async deleteReminder(userId: string, eventId: string, reminderId: string) {
    const event = await this.getEventById(userId, eventId);
    const reminder = event.reminders.find(r => r.id === reminderId);
    if (!reminder) {
      throw new NotFoundException(`Reminder with ID ${reminderId} not found in this event.`);
    }

    await this.repository.deleteCalendarReminder(reminderId);
    await this.eventBus.publish(
      EventReminderRemovedEventPayload.eventName,
      new EventReminderRemovedEventPayload(eventId, userId, reminderId)
    ).catch(err => console.error(`Failed to publish EventReminderRemoved: ${err.message}`));
  }

  async addAttachment(userId: string, eventId: string, vaultFileId: string) {
    await this.getEventById(userId, eventId);

    // Validate file
    const file = await this.vaultService.getFileMetadata(userId, vaultFileId);
    if (file.status !== FileStatus.READY || file.deletedAt !== null) {
      throw new BadRequestException('Vault file is not ready.');
    }

    return this.repository.createAttachment(eventId, vaultFileId);
  }

  async deleteAttachment(userId: string, eventId: string, vaultFileId: string) {
    await this.getEventById(userId, eventId);
    await this.repository.deleteAttachment(eventId, vaultFileId);
  }

  async getConflicts(userId: string, eventId: string) {
    const event = await this.getEventById(userId, eventId);
    return this.conflictService.checkConflicts(
      userId,
      event.calendarId,
      event.startAt,
      event.endAt,
      event.recurrenceFrequency,
      {
        rrule: event.rrule || undefined,
        recurrenceEndAt: event.recurrenceEndAt || undefined,
        recurrenceCount: event.recurrenceCount || undefined,
      },
      eventId
    );
  }
}
