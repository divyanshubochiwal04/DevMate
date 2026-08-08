import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { RRule, Frequency } from 'rrule';
import { RecurrenceFrequency } from '@prisma/client';

export interface Occurrence {
  startAt: Date;
  endAt: Date;
}

@Injectable()
export class EventRecurrenceService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Translates a UTC date to its corresponding year/month/day/hour/minute/second 
   * represented in the target timezone.
   */
  getLocalDateComponents(utcDate: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(utcDate);

    const map: Record<string, string> = {};
    for (const part of parts) {
      map[part.type] = part.value;
    }

    return {
      year: parseInt(map.year, 10),
      month: parseInt(map.month, 10) - 1, // 0-indexed month
      day: parseInt(map.day, 10),
      hour: parseInt(map.hour, 10) === 24 ? 0 : parseInt(map.hour, 10),
      minute: parseInt(map.minute, 10),
      second: parseInt(map.second, 10),
    };
  }

  /**
   * Converts local timezone components back to a UTC Date.
   */
  localToUtc(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    timeZone: string
  ): Date {
    if (timeZone.toUpperCase() === 'UTC') {
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    }

    // Initial UTC estimate using local components as if they were UTC
    const utcTimeEstimate = Date.UTC(year, month, day, hour, minute, second);
    
    // Check what local components this estimate actually represents in the target timezone
    const actualLocal = this.getLocalDateComponents(new Date(utcTimeEstimate), timeZone);
    const actualLocalTime = Date.UTC(
      actualLocal.year,
      actualLocal.month,
      actualLocal.day,
      actualLocal.hour,
      actualLocal.minute,
      actualLocal.second
    );

    // Shift the estimate by the offset difference
    const diff = utcTimeEstimate - actualLocalTime;
    return new Date(utcTimeEstimate + diff);
  }

  /**
   * Generates occurrences for a recurring event within a specific date range [from, to].
   * The generation uses date arithmetic on local components to guarantee DST safety.
   */
  generateOccurrences(
    startAt: Date,
    endAt: Date,
    frequency: RecurrenceFrequency,
    timezone: string,
    from: Date,
    to: Date,
    options?: {
      rrule?: string;
      recurrenceEndAt?: Date;
      recurrenceCount?: number;
    }
  ): Occurrence[] {
    const tz = timezone || 'UTC';
    const maxOccurrences = this.configService.calendarMaxOccurrencesPerQuery || 365;

    // Non-recurring events
    if (frequency === RecurrenceFrequency.NONE) {
      if (startAt <= to && endAt >= from) {
        return [{ startAt, endAt }];
      }
      return [];
    }

    // Determine event duration in milliseconds
    const durationMs = endAt.getTime() - startAt.getTime();

    // Map startAt to its local components
    const startLoc = this.getLocalDateComponents(startAt, tz);
    const dtstartLocal = new Date(Date.UTC(
      startLoc.year,
      startLoc.month,
      startLoc.day,
      startLoc.hour,
      startLoc.minute,
      startLoc.second
    ));

    // Map query window "from" and "to" to local components to bound rrule generator
    const fromLoc = this.getLocalDateComponents(from, tz);
    const localFrom = new Date(Date.UTC(fromLoc.year, fromLoc.month, fromLoc.day, 0, 0, 0));

    const toLoc = this.getLocalDateComponents(to, tz);
    const localTo = new Date(Date.UTC(toLoc.year, toLoc.month, toLoc.day, 23, 59, 59));

    // Construct RRule options
    let rruleOptions: any = {
      dtstart: dtstartLocal,
    };

    if (frequency === RecurrenceFrequency.RRULE) {
      if (!options?.rrule) {
        throw new BadRequestException('rrule string is required when recurrenceFrequency is set to RRULE');
      }
      try {
        rruleOptions = RRule.parseString(options.rrule);
        rruleOptions.dtstart = dtstartLocal;
      } catch (err) {
        throw new BadRequestException(`Invalid RRULE string format: ${options.rrule}`);
      }
    } else {
      // Map other frequencies to RRule frequencies
      let freq: Frequency;
      switch (frequency) {
        case RecurrenceFrequency.DAILY:
          freq = RRule.DAILY;
          break;
        case RecurrenceFrequency.WEEKLY:
          freq = RRule.WEEKLY;
          break;
        case RecurrenceFrequency.MONTHLY:
          freq = RRule.MONTHLY;
          break;
        case RecurrenceFrequency.YEARLY:
          freq = RRule.YEARLY;
          break;
        default:
          freq = RRule.DAILY;
      }
      rruleOptions.freq = freq;
    }

    // Handle end bounds (count or until)
    if (options?.recurrenceEndAt) {
      const endLoc = this.getLocalDateComponents(options.recurrenceEndAt, tz);
      rruleOptions.until = new Date(Date.UTC(
        endLoc.year,
        endLoc.month,
        endLoc.day,
        endLoc.hour,
        endLoc.minute,
        endLoc.second
      ));
    }
    if (options?.recurrenceCount) {
      rruleOptions.count = options.recurrenceCount;
    }

    const rule = new RRule(rruleOptions);

    // Fetch occurrences generated within local bounding window
    const localOccurrences = rule.between(localFrom, localTo, true);

    // Apply the safety limit on returned occurrences
    const boundedLocal = localOccurrences.slice(0, maxOccurrences);

    const occurrences: Occurrence[] = [];

    for (const locDate of boundedLocal) {
      // Treat the generated date's UTC components as target local components
      const year = locDate.getUTCFullYear();
      const month = locDate.getUTCMonth();
      const day = locDate.getUTCDate();
      const hour = locDate.getUTCHours();
      const minute = locDate.getUTCMinutes();
      const second = locDate.getUTCSeconds();

      // Convert local components back to actual UTC for startAt
      const startUtc = this.localToUtc(year, month, day, hour, minute, second, tz);
      // For endAt, add the original duration in milliseconds
      const endUtc = new Date(startUtc.getTime() + durationMs);

      // Verify the translated occurrence matches query range [from, to]
      if (startUtc <= to && endUtc >= from) {
        occurrences.push({ startAt: startUtc, endAt: endUtc });
      }
    }

    return occurrences;
  }
}
