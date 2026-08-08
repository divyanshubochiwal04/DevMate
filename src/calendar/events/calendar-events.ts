export class CalendarCreatedEventPayload {
  static readonly eventName = 'CalendarCreated';
  constructor(
    public readonly calendarId: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly occurredAt: Date = new Date()
  ) {}
}

export class CalendarUpdatedEventPayload {
  static readonly eventName = 'CalendarUpdated';
  constructor(
    public readonly calendarId: string,
    public readonly userId: string,
    public readonly version: number,
    public readonly occurredAt: Date = new Date()
  ) {}
}

export class CalendarDeletedEventPayload {
  static readonly eventName = 'CalendarDeleted';
  constructor(
    public readonly calendarId: string,
    public readonly userId: string,
    public readonly occurredAt: Date = new Date()
  ) {}
}

export class CalendarEventCreatedEventPayload {
  static readonly eventName = 'CalendarEventCreated';
  constructor(
    public readonly eventId: string,
    public readonly userId: string,
    public readonly title: string,
    public readonly occurredAt: Date = new Date()
  ) {}
}

export class CalendarEventUpdatedEventPayload {
  static readonly eventName = 'CalendarEventUpdated';
  constructor(
    public readonly eventId: string,
    public readonly userId: string,
    public readonly version: number,
    public readonly occurredAt: Date = new Date()
  ) {}
}

export class CalendarEventRescheduledEventPayload {
  static readonly eventName = 'CalendarEventRescheduled';
  constructor(
    public readonly eventId: string,
    public readonly userId: string,
    public readonly oldStart: Date,
    public readonly oldEnd: Date,
    public readonly newStart: Date,
    public readonly newEnd: Date,
    public readonly occurredAt: Date = new Date()
  ) {}
}

export class CalendarEventCancelledEventPayload {
  static readonly eventName = 'CalendarEventCancelled';
  constructor(
    public readonly eventId: string,
    public readonly userId: string,
    public readonly occurredAt: Date = new Date()
  ) {}
}

export class CalendarEventCompletedEventPayload {
  static readonly eventName = 'CalendarEventCompleted';
  constructor(
    public readonly eventId: string,
    public readonly userId: string,
    public readonly occurredAt: Date = new Date()
  ) {}
}

export class CalendarEventDeletedEventPayload {
  static readonly eventName = 'CalendarEventDeleted';
  constructor(
    public readonly eventId: string,
    public readonly userId: string,
    public readonly occurredAt: Date = new Date()
  ) {}
}

export class EventAttendeeAddedEventPayload {
  static readonly eventName = 'EventAttendeeAdded';
  constructor(
    public readonly eventId: string,
    public readonly userId: string,
    public readonly attendeeId: string,
    public readonly name: string,
    public readonly occurredAt: Date = new Date()
  ) {}
}

export class EventAttendeeRemovedEventPayload {
  static readonly eventName = 'EventAttendeeRemoved';
  constructor(
    public readonly eventId: string,
    public readonly userId: string,
    public readonly attendeeId: string,
    public readonly occurredAt: Date = new Date()
  ) {}
}

export class EventReminderAddedEventPayload {
  static readonly eventName = 'EventReminderAdded';
  constructor(
    public readonly eventId: string,
    public readonly userId: string,
    public readonly reminderId: string,
    public readonly offsetMinutes: number,
    public readonly occurredAt: Date = new Date()
  ) {}
}

export class EventReminderRemovedEventPayload {
  static readonly eventName = 'EventReminderRemoved';
  constructor(
    public readonly eventId: string,
    public readonly userId: string,
    public readonly reminderId: string,
    public readonly occurredAt: Date = new Date()
  ) {}
}
