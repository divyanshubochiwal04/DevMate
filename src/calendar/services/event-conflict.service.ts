import { Injectable } from '@nestjs/common';
import { CalendarRepository } from '../repositories/calendar.repository';
import { EventRecurrenceService } from './event-recurrence.service';
import { RecurrenceFrequency } from '@prisma/client';

@Injectable()
export class EventConflictService {
  constructor(
    private readonly repository: CalendarRepository,
    private readonly recurrenceService: EventRecurrenceService
  ) {}

  /**
   * Detects overlaps between a proposed event range (including its recurrence occurrences) 
   * and existing events in the same calendar.
   */
  async checkConflicts(
    userId: string,
    calendarId: string,
    startAt: Date,
    endAt: Date,
    frequency: RecurrenceFrequency,
    recurrenceOptions: {
      rrule?: string;
      recurrenceEndAt?: Date;
      recurrenceCount?: number;
    },
    excludeEventId?: string
  ): Promise<{ hasConflict: boolean; conflictingEvents: any[] }> {
    // 1. Establish the query window boundaries.
    // We check overlaps from startAt up to recurrenceEndAt, or up to 3 months into the future.
    const startRange = new Date(startAt.getTime() - 24 * 60 * 60 * 1000); // 1 day cushion
    let endRange = new Date(endAt.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days future limit

    if (recurrenceOptions.recurrenceEndAt) {
      endRange = new Date(Math.min(recurrenceOptions.recurrenceEndAt.getTime(), endRange.getTime()));
    }

    // 2. Retrieve existing events in the calendar
    const existingEvents = await this.repository.findEventsByCalendar(calendarId, startRange, endRange);

    // 3. Generate occurrences for the proposed new event
    const timezone = existingEvents[0]?.calendar?.timezone || 'UTC';
    const newOccurrences = this.recurrenceService.generateOccurrences(
      startAt,
      endAt,
      frequency,
      timezone,
      startRange,
      endRange,
      recurrenceOptions
    );

    const conflictingEventsMap = new Map<string, any>();

    // 4. Overlap checks
    for (const extEvent of existingEvents) {
      // Skip the event being updated/edited
      if (excludeEventId && extEvent.id === excludeEventId) {
        continue;
      }
      // Skip completed or cancelled events
      if (extEvent.status === 'CANCELLED' || extEvent.status === 'COMPLETED') {
        continue;
      }

      // Generate occurrences for this existing event
      const extOccurrences = this.recurrenceService.generateOccurrences(
        extEvent.startAt,
        extEvent.endAt,
        extEvent.recurrenceFrequency,
        extEvent.timezone,
        startRange,
        endRange,
        {
          rrule: extEvent.rrule || undefined,
          recurrenceEndAt: extEvent.recurrenceEndAt || undefined,
          recurrenceCount: extEvent.recurrenceCount || undefined,
        }
      );

      // Check cross-occurrences overlaps
      for (const newOcc of newOccurrences) {
        for (const extOcc of extOccurrences) {
          if (newOcc.startAt < extOcc.endAt && newOcc.endAt > extOcc.startAt) {
            conflictingEventsMap.set(extEvent.id, {
              id: extEvent.id,
              title: extEvent.title,
              startAt: extEvent.startAt,
              endAt: extEvent.endAt,
            });
            break; // Move to next event once an overlap is detected for this event
          }
        }
        if (conflictingEventsMap.has(extEvent.id)) {
          break;
        }
      }
    }

    const conflictingEvents = Array.from(conflictingEventsMap.values());

    return {
      hasConflict: conflictingEvents.length > 0,
      conflictingEvents,
    };
  }
}
