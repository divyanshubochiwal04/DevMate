export class ReminderCreatedEventPayload {
  static readonly eventName = 'ReminderCreated';
  constructor(
    public readonly reminderId: string,
    public readonly userId: string,
    public readonly type: string,
    public readonly triggerTime: Date
  ) {}
}

export class ReminderUpdatedEventPayload {
  static readonly eventName = 'ReminderUpdated';
  constructor(
    public readonly reminderId: string,
    public readonly userId: string,
    public readonly type: string,
    public readonly nextExecutionAt: Date | null
  ) {}
}

export class ReminderTriggeredEventPayload {
  static readonly eventName = 'ReminderTriggered';
  constructor(
    public readonly reminderId: string,
    public readonly userId: string,
    public readonly executionId: string,
    public readonly triggerSource: string
  ) {}
}

export class ReminderCompletedEventPayload {
  static readonly eventName = 'ReminderCompleted';
  constructor(
    public readonly reminderId: string,
    public readonly userId: string,
    public readonly completedAt: Date
  ) {}
}

export class ReminderCancelledEventPayload {
  static readonly eventName = 'ReminderCancelled';
  constructor(
    public readonly reminderId: string,
    public readonly userId: string,
    public readonly cancelledAt: Date
  ) {}
}

export class ReminderFailedEventPayload {
  static readonly eventName = 'ReminderFailed';
  constructor(
    public readonly reminderId: string,
    public readonly userId: string,
    public readonly failedAt: Date,
    public readonly errorMessage: string
  ) {}
}

export class ReminderSnoozedEventPayload {
  static readonly eventName = 'ReminderSnoozed';
  constructor(
    public readonly reminderId: string,
    public readonly userId: string,
    public readonly snoozedUntil: Date
  ) {}
}

export class ReminderMissedEventPayload {
  static readonly eventName = 'ReminderMissed';
  constructor(
    public readonly reminderId: string,
    public readonly userId: string,
    public readonly missedAt: Date
  ) {}
}
