import { AccountType, TransactionType, TransactionStatus, Currency, BudgetPeriod, LoanStatus, LoanDirection, EMIStatus, SubscriptionStatus, FinancialGoalStatus, ReminderFrequency } from '@prisma/client';
import { Money } from '../money.vo';

export class AccountEntity {
  id!: string;
  userId!: string;
  name!: string;
  type!: AccountType;
  allowNegativeBalance!: boolean;
  
  openingBalance!: Money;
  currentBalance!: Money;
  availableBalance!: Money;

  createdAt!: Date;
  updatedAt!: Date;
  version!: number;

  constructor(partial: Partial<AccountEntity>) {
    Object.assign(this, partial);
  }
}

export class TransactionEntity {
  id!: string;
  userId!: string;
  type!: TransactionType;
  status!: TransactionStatus;
  description!: string;
  reference?: string | null;
  notes?: string | null;
  transferId?: string | null;
  exchangeRate!: string; // string serialized decimal

  money!: Money;
  baseMoney!: Money;

  categoryId?: string | null;
  accountId!: string;
  toAccountId?: string | null;
  recurringId?: string | null;

  occurredAt!: Date;
  postedAt?: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
  version!: number;

  constructor(partial: Partial<TransactionEntity>) {
    Object.assign(this, partial);
  }
}

export class LedgerEntryEntity {
  id!: string;
  userId!: string;
  accountId!: string;
  transactionId?: string | null;
  type!: string; // "DEBIT" or "CREDIT"
  description!: string;
  money!: Money;
  createdAt!: Date;

  constructor(partial: Partial<LedgerEntryEntity>) {
    Object.assign(this, partial);
  }
}

export class BudgetEntity {
  id!: string;
  userId!: string;
  period!: BudgetPeriod;
  startDate!: Date;
  endDate!: Date;
  categoryId?: string | null;

  allocatedMoney!: Money;
  spentMoney!: Money;
  remainingMoney!: Money;
  progress!: number; // Percentage spent (e.g. 75.0)

  createdAt!: Date;
  updatedAt!: Date;

  constructor(partial: Partial<BudgetEntity>) {
    Object.assign(this, partial);
  }
}

export class LoanEntity {
  id!: string;
  userId!: string;
  interestRate!: string; // string serialized APR
  durationMonths!: number;
  startDate!: Date;
  status!: LoanStatus;
  direction!: LoanDirection;
  
  principalMoney!: Money;
  remainingBalanceMoney!: Money;

  createdAt!: Date;
  updatedAt!: Date;
  version!: number;

  constructor(partial: Partial<LoanEntity>) {
    Object.assign(this, partial);
  }
}

export class LoanEMIEntity {
  id!: string;
  loanId!: string;
  dueDate!: Date;
  status!: EMIStatus;
  installmentNumber!: number;
  remainingInstallments!: number;
  paidAt?: Date | null;

  money!: Money;
  lateFeeMoney!: Money;

  createdAt!: Date;
  updatedAt!: Date;

  constructor(partial: Partial<LoanEMIEntity>) {
    Object.assign(this, partial);
  }
}

export class SubscriptionEntity {
  id!: string;
  userId!: string;
  name!: string;
  cycle!: string;
  nextBilling!: Date;
  status!: SubscriptionStatus;
  trial!: boolean;
  autoRenew!: boolean;
  cancelledAt?: Date | null;

  money!: Money;

  createdAt!: Date;
  updatedAt!: Date;

  constructor(partial: Partial<SubscriptionEntity>) {
    Object.assign(this, partial);
  }
}

export class RecurringTransactionEntity {
  id!: string;
  userId!: string;
  type!: TransactionType;
  description!: string;
  categoryId?: string | null;
  accountId!: string;
  toAccountId?: string | null;

  money!: Money;

  frequency!: ReminderFrequency;
  rrule?: string | null;
  startDate!: Date;
  endDate?: Date | null;
  nextRun?: Date | null;
  lastRun?: Date | null;
  occurrenceCount!: number;
  maxOccurrences?: number | null;

  createdAt!: Date;
  updatedAt!: Date;
  version!: number;

  constructor(partial: Partial<RecurringTransactionEntity>) {
    Object.assign(this, partial);
  }
}

export class CategoryEntity {
  id!: string;
  userId!: string;
  name!: string;
  parentId?: string | null;
  sortOrder!: number;
  isArchived!: boolean;
  isFavorite!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(partial: Partial<CategoryEntity>) {
    Object.assign(this, partial);
  }
}

export class FinancialGoalEntity {
  id!: string;
  userId!: string;
  name!: string;
  deadline?: Date | null;
  status!: FinancialGoalStatus;
  linkedAccountId?: string | null;

  targetMoney!: Money;
  savedMoney!: Money;

  createdAt!: Date;
  updatedAt!: Date;

  constructor(partial: Partial<FinancialGoalEntity>) {
    Object.assign(this, partial);
  }
}
