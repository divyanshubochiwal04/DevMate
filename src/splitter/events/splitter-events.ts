import { randomUUID } from 'crypto';
import { loggerContextStorage } from '../../common/logger/logger-context';

export class DomainEventEnvelope<T = any> {
  public readonly eventId: string;
  public readonly occurredAt: Date;
  public readonly requestId: string | null;
  public readonly correlationId: string;

  constructor(
    public readonly eventType: string,
    public readonly aggregateId: string,
    public readonly aggregateType: string,
    public readonly actorId: string,
    public readonly payload: T
  ) {
    this.eventId = randomUUID();
    this.occurredAt = new Date();
    const store = loggerContextStorage.getStore();
    this.requestId = store?.requestId || null;
    this.correlationId = store?.correlationId || randomUUID();
  }
}

export class SplitGroupCreatedEvent extends DomainEventEnvelope {
  static readonly eventName = 'SplitGroupCreated';
  constructor(groupId: string, actorId: string, payload: any) {
    super(SplitGroupCreatedEvent.eventName, groupId, 'SplitGroup', actorId, payload);
  }
}

export class SplitGroupUpdatedEvent extends DomainEventEnvelope {
  static readonly eventName = 'SplitGroupUpdated';
  constructor(groupId: string, actorId: string, payload: any) {
    super(SplitGroupUpdatedEvent.eventName, groupId, 'SplitGroup', actorId, payload);
  }
}

export class SplitMemberAddedEvent extends DomainEventEnvelope {
  static readonly eventName = 'SplitMemberAdded';
  constructor(groupId: string, memberId: string, actorId: string, payload: any) {
    super(SplitMemberAddedEvent.eventName, memberId, 'SplitMember', actorId, { groupId, ...payload });
  }
}

export class SplitMemberRemovedEvent extends DomainEventEnvelope {
  static readonly eventName = 'SplitMemberRemoved';
  constructor(groupId: string, memberId: string, actorId: string, payload: any) {
    super(SplitMemberRemovedEvent.eventName, memberId, 'SplitMember', actorId, { groupId, ...payload });
  }
}

export class GroupExpenseCreatedEvent extends DomainEventEnvelope {
  static readonly eventName = 'GroupExpenseCreated';
  constructor(groupId: string, expenseId: string, actorId: string, payload: any) {
    super(GroupExpenseCreatedEvent.eventName, expenseId, 'GroupExpense', actorId, { groupId, ...payload });
  }
}

export class GroupExpenseUpdatedEvent extends DomainEventEnvelope {
  static readonly eventName = 'GroupExpenseUpdated';
  constructor(groupId: string, expenseId: string, actorId: string, payload: any) {
    super(GroupExpenseUpdatedEvent.eventName, expenseId, 'GroupExpense', actorId, { groupId, ...payload });
  }
}

export class GroupExpenseVoidedEvent extends DomainEventEnvelope {
  static readonly eventName = 'GroupExpenseVoided';
  constructor(groupId: string, expenseId: string, actorId: string, payload: any) {
    super(GroupExpenseVoidedEvent.eventName, expenseId, 'GroupExpense', actorId, { groupId, ...payload });
  }
}

export class SettlementCreatedEvent extends DomainEventEnvelope {
  static readonly eventName = 'SettlementCreated';
  constructor(groupId: string, settlementId: string, actorId: string, payload: any) {
    super(SettlementCreatedEvent.eventName, settlementId, 'Settlement', actorId, { groupId, ...payload });
  }
}

export class SettlementCompletedEvent extends DomainEventEnvelope {
  static readonly eventName = 'SettlementCompleted';
  constructor(groupId: string, settlementId: string, actorId: string, payload: any) {
    super(SettlementCompletedEvent.eventName, settlementId, 'Settlement', actorId, { groupId, ...payload });
  }
}

export class SettlementCancelledEvent extends DomainEventEnvelope {
  static readonly eventName = 'SettlementCancelled';
  constructor(groupId: string, settlementId: string, actorId: string, payload: any) {
    super(SettlementCancelledEvent.eventName, settlementId, 'Settlement', actorId, { groupId, ...payload });
  }
}

export class GroupBalanceChangedEvent extends DomainEventEnvelope {
  static readonly eventName = 'GroupBalanceChanged';
  constructor(groupId: string, actorId: string) {
    super(GroupBalanceChangedEvent.eventName, groupId, 'SplitGroup', actorId, {});
  }
}
