import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CalendarType, EventType, EventStatus, RecurrenceFrequency, AttendeeStatus, Prisma } from '@prisma/client';

@Injectable()
export class CalendarRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Calendars CRUD ───

  async findDefaultCalendar(userId: string) {
    return this.prisma.calendar.findFirst({
      where: { userId, isDefault: true, deletedAt: null },
    });
  }

  async findCalendarById(id: string, userId: string) {
    return this.prisma.calendar.findFirst({
      where: { id, userId, deletedAt: null },
    });
  }

  async listCalendars(userId: string) {
    return this.prisma.calendar.findMany({
      where: { userId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createCalendar(userId: string, data: {
    name: string;
    description?: string;
    type?: CalendarType;
    timezone?: string;
    isDefault?: boolean;
    isVisible?: boolean;
    sortOrder?: number;
  }, tx?: Prisma.TransactionClient) {
    const execute = async (t: Prisma.TransactionClient) => {
      // If setting as default, unset existing default calendar first
      if (data.isDefault) {
        await t.calendar.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return t.calendar.create({
        data: {
          ...data,
          userId,
          version: 1,
        },
      });
    };

    return tx ? execute(tx) : this.prisma.$transaction(execute);
  }

  async updateCalendar(
    id: string,
    userId: string,
    currentVersion: number,
    data: {
      name?: string;
      description?: string;
      type?: CalendarType;
      timezone?: string;
      isDefault?: boolean;
      isVisible?: boolean;
      sortOrder?: number;
      deletedAt?: Date;
    },
    tx?: Prisma.TransactionClient
  ) {
    const execute = async (t: Prisma.TransactionClient) => {
      // If setting as default, unset existing default calendar first
      if (data.isDefault) {
        await t.calendar.updateMany({
          where: { userId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      const result = await t.calendar.updateMany({
        where: { id, userId, version: currentVersion },
        data: {
          ...data,
          version: currentVersion + 1,
        },
      });

      if (result.count === 0) {
        throw new ConflictException('Optimistic concurrency lock failed: Calendar has been modified by another request.');
      }

      return t.calendar.findFirst({ where: { id, userId } });
    };

    return tx ? execute(tx) : this.prisma.$transaction(execute);
  }

  async setDefaultCalendarAtomic(id: string, userId: string, currentVersion: number, tx?: Prisma.TransactionClient) {
    const execute = async (t: Prisma.TransactionClient) => {
      await t.calendar.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });

      const result = await t.calendar.updateMany({
        where: { id, userId, version: currentVersion },
        data: {
          isDefault: true,
          version: currentVersion + 1,
        },
      });

      if (result.count === 0) {
        throw new ConflictException('Optimistic concurrency lock failed: Calendar has been modified.');
      }

      return t.calendar.findFirst({ where: { id, userId } });
    };

    return tx ? execute(tx) : this.prisma.$transaction(execute);
  }

  // ─── Events CRUD ───

  async findEventById(id: string, userId: string) {
    return this.prisma.calendarEvent.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        calendar: true,
        reminders: { where: { deletedAt: null } },
        attendees: { where: { deletedAt: null } },
        attachments: { include: { vaultFile: true } },
        recurrenceExceptions: true,
      },
    });
  }

  async findEventsByCalendar(calendarId: string, from: Date, to: Date) {
    return this.prisma.calendarEvent.findMany({
      where: {
        calendarId,
        deletedAt: null,
        // For recurring events, they might start before 'from', so we load all active ones 
        // and let the Recurrence Engine filter. To optimize, we load events starting before 'to'.
        startAt: { lte: to },
      },
      include: {
        calendar: true,
        reminders: { where: { deletedAt: null } },
        attendees: { where: { deletedAt: null } },
        attachments: { include: { vaultFile: true } },
        recurrenceExceptions: true,
      },
    });
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
    },
    skip?: number,
    take?: number
  ) {
    const whereClause: any = {
      userId,
      deletedAt: null,
    };

    if (filters.calendarId) whereClause.calendarId = filters.calendarId;
    if (filters.type) whereClause.type = filters.type;
    if (filters.status) whereClause.status = filters.status;
    if (filters.search) {
      whereClause.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.hasReminder) {
      whereClause.reminders = { some: { deletedAt: null } };
    }
    if (filters.hasAttendees) {
      whereClause.attendees = { some: { deletedAt: null } };
    }

    return this.prisma.calendarEvent.findMany({
      where: whereClause,
      include: {
        calendar: true,
        reminders: { where: { deletedAt: null } },
        attendees: { where: { deletedAt: null } },
        attachments: { include: { vaultFile: true } },
        recurrenceExceptions: true,
      },
      orderBy: { startAt: 'asc' },
      skip,
      take,
    });
  }

  async countEvents(
    userId: string,
    filters: {
      calendarId?: string;
      type?: EventType;
      status?: EventStatus;
      search?: string;
    }
  ) {
    const whereClause: any = {
      userId,
      deletedAt: null,
    };

    if (filters.calendarId) whereClause.calendarId = filters.calendarId;
    if (filters.type) whereClause.type = filters.type;
    if (filters.status) whereClause.status = filters.status;
    if (filters.search) {
      whereClause.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.calendarEvent.count({
      where: whereClause,
    });
  }

  async createEvent(
    userId: string,
    calendarId: string,
    data: {
      title: string;
      description?: string;
      startAt: Date;
      endAt: Date;
      timezone?: string;
      isAllDay?: boolean;
      type?: EventType;
      status?: EventStatus;
      locationName?: string;
      locationAddress?: string;
      latitude?: number;
      longitude?: number;
      meetingUrl?: string;
      recurrenceFrequency?: RecurrenceFrequency;
      rrule?: string;
      recurrenceEndAt?: Date;
      recurrenceCount?: number;
      parentRecurringEventId?: string;
      todoId?: string;
      noteId?: string;
      createdBy?: string;
    },
    relations: {
      reminders?: number[]; // offsets
      attendees?: { name: string; email?: string; telegramUsername?: string; status?: AttendeeStatus; userId?: string }[];
      attachments?: string[]; // vault file IDs
    },
    tx?: Prisma.TransactionClient
  ) {
    const execute = async (t: Prisma.TransactionClient) => {
      const event = await t.calendarEvent.create({
        data: {
          ...data,
          userId,
          calendarId,
          version: 1,
        },
      });

      if (relations.reminders && relations.reminders.length > 0) {
        await t.calendarReminder.createMany({
          data: relations.reminders.map((offset) => ({
            eventId: event.id,
            offsetMinutes: offset,
            triggerTime: new Date(data.startAt.getTime() - offset * 60 * 1000),
          })),
        });
      }

      if (relations.attendees && relations.attendees.length > 0) {
        await t.calendarAttendee.createMany({
          data: relations.attendees.map((att) => ({
            eventId: event.id,
            name: att.name,
            email: att.email || null,
            telegramUsername: att.telegramUsername || null,
            status: att.status || AttendeeStatus.PENDING,
            userId: att.userId || null,
          })),
        });
      }

      if (relations.attachments && relations.attachments.length > 0) {
        await t.eventAttachment.createMany({
          data: relations.attachments.map((fileId) => ({
            eventId: event.id,
            vaultFileId: fileId,
          })),
        });
      }

      return t.calendarEvent.findUnique({
        where: { id: event.id },
        include: {
          calendar: true,
          reminders: { where: { deletedAt: null } },
          attendees: { where: { deletedAt: null } },
          attachments: { include: { vaultFile: true } },
          recurrenceExceptions: true,
        },
      });
    };

    return tx ? execute(tx) : this.prisma.$transaction(execute);
  }

  async updateEvent(
    id: string,
    userId: string,
    currentVersion: number,
    data: {
      title?: string;
      description?: string;
      startAt?: Date;
      endAt?: Date;
      timezone?: string;
      isAllDay?: boolean;
      type?: EventType;
      status?: EventStatus;
      locationName?: string;
      locationAddress?: string;
      latitude?: number;
      longitude?: number;
      meetingUrl?: string;
      recurrenceFrequency?: RecurrenceFrequency;
      rrule?: string;
      recurrenceEndAt?: Date;
      recurrenceCount?: number;
      parentRecurringEventId?: string;
      todoId?: string;
      noteId?: string;
      updatedBy?: string;
      completedAt?: Date;
      cancelledAt?: Date;
      deletedAt?: Date;
    },
    relations?: {
      reminders?: number[];
      attendees?: { name: string; email?: string; telegramUsername?: string; status?: AttendeeStatus; userId?: string }[];
      attachments?: string[];
    },
    tx?: Prisma.TransactionClient
  ) {
    const execute = async (t: Prisma.TransactionClient) => {
      const result = await t.calendarEvent.updateMany({
        where: { id, userId, version: currentVersion },
        data: {
          ...data,
          version: currentVersion + 1,
        },
      });

      if (result.count === 0) {
        throw new ConflictException('Optimistic concurrency lock failed: Event has been modified by another request.');
      }

      if (relations) {
        if (relations.reminders !== undefined) {
          await t.calendarReminder.deleteMany({ where: { eventId: id } });
          if (relations.reminders.length > 0) {
            const start = data.startAt || (await t.calendarEvent.findUnique({ where: { id } }))!.startAt;
            await t.calendarReminder.createMany({
              data: relations.reminders.map((offset) => ({
                eventId: id,
                offsetMinutes: offset,
                triggerTime: new Date(start.getTime() - offset * 60 * 1000),
              })),
            });
          }
        }

        if (relations.attendees !== undefined) {
          await t.calendarAttendee.deleteMany({ where: { eventId: id } });
          if (relations.attendees.length > 0) {
            await t.calendarAttendee.createMany({
              data: relations.attendees.map((att) => ({
                eventId: id,
                name: att.name,
                email: att.email || null,
                telegramUsername: att.telegramUsername || null,
                status: att.status || AttendeeStatus.PENDING,
                userId: att.userId || null,
              })),
            });
          }
        }

        if (relations.attachments !== undefined) {
          await t.eventAttachment.deleteMany({ where: { eventId: id } });
          if (relations.attachments.length > 0) {
            await t.eventAttachment.createMany({
              data: relations.attachments.map((fileId) => ({
                eventId: id,
                vaultFileId: fileId,
              })),
            });
          }
        }
      }

      return t.calendarEvent.findFirst({
        where: { id, userId },
        include: {
          calendar: true,
          reminders: { where: { deletedAt: null } },
          attendees: { where: { deletedAt: null } },
          attachments: { include: { vaultFile: true } },
          recurrenceExceptions: true,
        },
      });
    };

    return tx ? execute(tx) : this.prisma.$transaction(execute);
  }

  // ─── Recurrence Exceptions ───

  async createRecurrenceException(data: {
    eventId: string;
    originalOccurrenceAt: Date;
    type: string;
    overrideData?: any;
  }) {
    return this.prisma.eventRecurrenceException.create({
      data,
    });
  }

  async deleteRecurrenceExceptionsForEvent(eventId: string) {
    return this.prisma.eventRecurrenceException.deleteMany({
      where: { eventId },
    });
  }

  async deleteRecurrenceException(eventId: string, originalOccurrenceAt: Date) {
    return this.prisma.eventRecurrenceException.deleteMany({
      where: { eventId, originalOccurrenceAt },
    });
  }

  // ─── Attendees CRUD ───

  async createAttendee(eventId: string, data: { name: string; email?: string; telegramUsername?: string; status?: AttendeeStatus; userId?: string }) {
    return this.prisma.calendarAttendee.create({
      data: {
        eventId,
        ...data,
      },
    });
  }

  async updateAttendee(id: string, eventId: string, data: { status?: AttendeeStatus; name?: string; email?: string; telegramUsername?: string }) {
    return this.prisma.calendarAttendee.update({
      where: { id },
      data,
    });
  }

  async deleteAttendee(id: string, eventId: string) {
    return this.prisma.calendarAttendee.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ─── Reminders CRUD ───

  async createCalendarReminder(eventId: string, offsetMinutes: number, triggerTime: Date) {
    return this.prisma.calendarReminder.create({
      data: {
        eventId,
        offsetMinutes,
        triggerTime,
      },
    });
  }

  async deleteCalendarReminder(id: string) {
    return this.prisma.calendarReminder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ─── Attachments CRUD ───

  async createAttachment(eventId: string, vaultFileId: string) {
    return this.prisma.eventAttachment.create({
      data: {
        eventId,
        vaultFileId,
      },
    });
  }

  async deleteAttachment(eventId: string, vaultFileId: string) {
    return this.prisma.eventAttachment.deleteMany({
      where: { eventId, vaultFileId },
    });
  }
}
