export class TransactionCreatedEventPayload {
  static readonly eventName = 'TransactionCreated';
  constructor(
    public readonly transactionId: string,
    public readonly userId: string,
    public readonly type: string,
    public readonly amount: string,
    public readonly currency: string,
    public readonly occurredAt: Date
  ) {}
}

export class ExpenseCreatedEventPayload {
  static readonly eventName = 'ExpenseCreated';
  constructor(
    public readonly transactionId: string,
    public readonly userId: string,
    public readonly amount: string,
    public readonly currency: string
  ) {}
}

export class IncomeCreatedEventPayload {
  static readonly eventName = 'IncomeCreated';
  constructor(
    public readonly transactionId: string,
    public readonly userId: string,
    public readonly amount: string,
    public readonly currency: string
  ) {}
}

export class BudgetExceededEventPayload {
  static readonly eventName = 'BudgetExceeded';
  constructor(
    public readonly budgetId: string,
    public readonly userId: string,
    public readonly categoryId: string | null,
    public readonly allocated: string,
    public readonly spent: string,
    public readonly currency: string
  ) {}
}

export class LoanCreatedEventPayload {
  static readonly eventName = 'LoanCreated';
  constructor(
    public readonly loanId: string,
    public readonly userId: string,
    public readonly principal: string,
    public readonly currency: string
  ) {}
}

export class LoanUpdatedEventPayload {
  static readonly eventName = 'LoanUpdated';
  constructor(
    public readonly loanId: string,
    public readonly userId: string,
    public readonly remainingBalance: string,
    public readonly currency: string
  ) {}
}

export class EMICreatedEventPayload {
  static readonly eventName = 'EMICreated';
  constructor(
    public readonly emiId: string,
    public readonly loanId: string,
    public readonly amount: string,
    public readonly dueDate: Date
  ) {}
}

export class SubscriptionCreatedEventPayload {
  static readonly eventName = 'SubscriptionCreated';
  constructor(
    public readonly subscriptionId: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly amount: string,
    public readonly nextBilling: Date
  ) {}
}

export class RecurringTransactionCreatedEventPayload {
  static readonly eventName = 'RecurringTransactionCreated';
  constructor(
    public readonly recurringId: string,
    public readonly userId: string,
    public readonly amount: string,
    public readonly frequency: string,
    public readonly startDate: Date
  ) {}
}

// ─── Reminder Integration Event Payloads ───

export class SubscriptionRenewalDueEventPayload {
  static readonly eventName = 'SubscriptionRenewalDue';
  constructor(
    public readonly subscriptionId: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly amount: string,
    public readonly renewalDate: Date
  ) {}
}

export class EMIDueEventPayload {
  static readonly eventName = 'EMIDue';
  constructor(
    public readonly emiId: string,
    public readonly loanId: string,
    public readonly amount: string,
    public readonly dueDate: Date
  ) {}
}

export class RecurringTransactionDueEventPayload {
  static readonly eventName = 'RecurringTransactionDue';
  constructor(
    public readonly recurringId: string,
    public readonly userId: string,
    public readonly amount: string,
    public readonly dueDate: Date
  ) {}
}
