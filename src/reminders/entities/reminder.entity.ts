export class ReminderRuleEntity {
  id!: string;
  frequency!: string;
  rrule!: string | null;
  timezone!: string;
  startAt!: Date | null;
  endAt!: Date | null;
  occurrenceCount!: number;
  maxOccurrences!: number | null;

  constructor(partial: Partial<ReminderRuleEntity>) {
    Object.assign(this, partial);
  }
}

export class ReminderHistoryEntity {
  id!: string;
  executionId!: string;
  triggerSource!: string;
  workerId!: string | null;
  scheduledAt!: Date;
  executedAt!: Date;
  duration!: number;
  result!: string;
  error!: string | null;
  retry!: number;

  constructor(partial: Partial<ReminderHistoryEntity>) {
    Object.assign(this, partial);
  }
}

export class ReminderEntity {
  id!: string;
  userId!: string;
  text!: string;
  type!: string;
  targetId!: string | null;
  targetType!: string | null;
  triggerTime!: Date;
  snoozeMinutes!: number;
  snoozedUntil!: Date | null;
  status!: string;
  nextExecutionAt!: Date | null;
  lastExecutedAt!: Date | null;
  retryCount!: number;
  maxRetries!: number;
  retryStrategy!: string;
  createdAt!: Date;
  updatedAt!: Date;
  version!: number;

  rule!: ReminderRuleEntity | null;
  history!: ReminderHistoryEntity[];

  constructor(partial: Partial<ReminderEntity>) {
    Object.assign(this, partial);
  }
}
