import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { FinanceRepository } from '../repositories/finance.repository';
import { IEventBus } from '../../telegram/interfaces/event-bus.interface';
import { PrismaService } from '../../database/prisma.service';
import { Money } from '../money.vo';
import {
  AccountEntity,
  TransactionEntity,
  BudgetEntity,
  LoanEntity,
  LoanEMIEntity,
  SubscriptionEntity,
  RecurringTransactionEntity,
  CategoryEntity,
} from '../entities/finance.entity';
import {
  TransactionCreatedEventPayload,
  ExpenseCreatedEventPayload,
  IncomeCreatedEventPayload,
  BudgetExceededEventPayload,
  LoanCreatedEventPayload,
  LoanUpdatedEventPayload,
  EMICreatedEventPayload,
  SubscriptionCreatedEventPayload,
  RecurringTransactionCreatedEventPayload,
} from '../events/finance-events';
import { CreateAccountDto } from '../dto/account.dto';
import { CreateTransactionDto } from '../dto/transaction.dto';
import { CreateBudgetDto } from '../dto/budget.dto';
import { CreateLoanDto } from '../dto/loan.dto';
import { CreateSubscriptionDto } from '../dto/subscription.dto';
import { CreateRecurringTransactionDto } from '../dto/recurring.dto';
import { CreateCategoryDto } from '../dto/category.dto';
import { Prisma, AccountType, TransactionType, TransactionStatus, Currency, BudgetPeriod, LoanStatus, LoanDirection, EMIStatus, SubscriptionStatus, ReminderFrequency } from '@prisma/client';

@Injectable()
export class FinanceService {
  constructor(
    private readonly repository: FinanceRepository,
    private readonly prisma: PrismaService, // For checking ledger sums & manual aggregates
    @Inject(IEventBus) private readonly eventBus: IEventBus
  ) {}

  // ─── Accounts Service ───

  async createAccount(userId: string, dto: CreateAccountDto): Promise<AccountEntity> {
    const opening = dto.openingBalance ? new Prisma.Decimal(dto.openingBalance) : new Prisma.Decimal(0.0);
    const account = await this.repository.createAccount(userId, {
      name: dto.name,
      type: dto.type,
      currency: dto.currency,
      openingBalance: opening,
      allowNegativeBalance: dto.allowNegativeBalance || false,
    });
    return this.mapAccountToEntity(account);
  }

  async getAccountById(id: string): Promise<AccountEntity> {
    const acc = await this.repository.findAccountById(id);
    if (!acc) throw new NotFoundException(`Account ${id} not found`);
    return this.mapAccountToEntity(acc);
  }

  async listAccounts(userId: string): Promise<AccountEntity[]> {
    const list = await this.repository.listAccounts(userId);
    return list.map(a => this.mapAccountToEntity(a));
  }

  // ─── Transactions Service ───

  async createTransaction(userId: string, dto: CreateTransactionDto): Promise<TransactionEntity> {
    const amount = new Prisma.Decimal(dto.amount);
    const rate = dto.exchangeRate ? new Prisma.Decimal(dto.exchangeRate) : new Prisma.Decimal(1.0);

    if (dto.type === TransactionType.TRANSFER) {
      if (!dto.toAccountId) {
        throw new BadRequestException('Destination account (toAccountId) is required for transfers');
      }
      if (dto.accountId === dto.toAccountId) {
        throw new BadRequestException('Source and destination accounts must be different');
      }
    }

    // Trigger db update
    const tx = await this.repository.createTransaction(userId, {
      type: dto.type,
      status: dto.status,
      amount,
      currency: dto.currency,
      description: dto.description,
      reference: dto.reference,
      notes: dto.notes,
      categoryId: dto.categoryId,
      accountId: dto.accountId,
      toAccountId: dto.toAccountId,
      exchangeRate: rate,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
    });

    const entity = this.mapTxToEntity(tx);

    // 1. Emit standard TransactionCreated
    await this.eventBus.publish(
      TransactionCreatedEventPayload.eventName,
      new TransactionCreatedEventPayload(
        entity.id,
        userId,
        entity.type,
        entity.money.amount.toString(),
        entity.money.currency,
        entity.occurredAt
      )
    );

    // 2. Emit specific Expense/Income events
    if (entity.type === TransactionType.EXPENSE) {
      await this.eventBus.publish(
        ExpenseCreatedEventPayload.eventName,
        new ExpenseCreatedEventPayload(entity.id, userId, entity.money.amount.toString(), entity.money.currency)
      );

      // Check budget progress
      await this.checkBudgetLimits(userId, entity.categoryId || null, amount.abs(), entity.money.currency);
    } else if (entity.type === TransactionType.INCOME) {
      await this.eventBus.publish(
        IncomeCreatedEventPayload.eventName,
        new IncomeCreatedEventPayload(entity.id, userId, entity.money.amount.toString(), entity.money.currency)
      );
    }

    return entity;
  }

  async listTransactions(
    userId: string,
    filters: { accountId?: string; type?: TransactionType; status?: TransactionStatus; reference?: string }
  ): Promise<TransactionEntity[]> {
    const list = await this.repository.listTransactions(userId, filters);
    return list.map(t => this.mapTxToEntity(t));
  }

  // ─── Categories Service ───

  async createCategory(userId: string, dto: CreateCategoryDto): Promise<CategoryEntity> {
    const cat = await this.repository.createCategory(userId, dto);
    return new CategoryEntity(cat);
  }

  async listCategories(userId: string): Promise<CategoryEntity[]> {
    const list = await this.repository.listCategories(userId);
    return list.map(c => new CategoryEntity(c));
  }

  // ─── Budgets Service ───

  async createBudget(userId: string, dto: CreateBudgetDto): Promise<BudgetEntity> {
    const budget = await this.repository.createBudget(userId, {
      amount: new Prisma.Decimal(dto.amount),
      currency: dto.currency,
      period: dto.period,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      categoryId: dto.categoryId,
    });
    return this.mapBudgetToEntity(budget, new Prisma.Decimal(0.0));
  }

  async listBudgets(userId: string): Promise<BudgetEntity[]> {
    const budgets = await this.repository.listBudgets(userId);
    const result: BudgetEntity[] = [];

    for (const b of budgets) {
      // Calculate spent amount in this budget period
      const txs = await this.prisma.transaction.findMany({
        where: {
          userId,
          categoryId: b.categoryId,
          occurredAt: { gte: b.startDate, lte: b.endDate },
          type: TransactionType.EXPENSE,
          status: TransactionStatus.POSTED,
        },
      });

      let spent = new Prisma.Decimal(0.0);
      for (const t of txs) {
        spent = spent.add(t.amount.abs());
      }
      result.push(this.mapBudgetToEntity(b, spent));
    }

    return result;
  }

  // ─── Loans & EMI Service ───

  async createLoan(userId: string, dto: CreateLoanDto): Promise<LoanEntity> {
    const loan = await this.repository.createLoan(userId, {
      principal: new Prisma.Decimal(dto.principal),
      currency: dto.currency,
      interestRate: new Prisma.Decimal(dto.interestRate),
      durationMonths: dto.durationMonths,
      startDate: new Date(dto.startDate),
      direction: dto.direction,
    });

    // Auto-generate EMIs for the loan duration
    // EMI amount = principal / durationMonths
    const emiAmount = new Prisma.Decimal(dto.principal).div(dto.durationMonths);
    for (let i = 1; i <= dto.durationMonths; i++) {
      const dueDate = new Date(dto.startDate);
      dueDate.setMonth(dueDate.getMonth() + i);

      const emi = await this.repository.createEMI(loan.id, {
        amount: emiAmount,
        currency: dto.currency,
        dueDate,
        installmentNumber: i,
        remainingInstallments: dto.durationMonths - i,
      });

      // Emit EMICreated event
      await this.eventBus.publish(
        EMICreatedEventPayload.eventName,
        new EMICreatedEventPayload(emi.id, loan.id, emiAmount.toString(), dueDate)
      );
    }

    // Emit LoanCreated event
    await this.eventBus.publish(
      LoanCreatedEventPayload.eventName,
      new LoanCreatedEventPayload(loan.id, userId, loan.principal.toString(), loan.currency)
    );

    const fresh = await this.repository.findLoanById(loan.id);
    return this.mapLoanToEntity(fresh);
  }

  async listLoans(userId: string): Promise<LoanEntity[]> {
    const list = await this.repository.listLoans(userId);
    return list.map(l => this.mapLoanToEntity(l));
  }

  async payEMI(id: string, lateFee = '0.0000'): Promise<LoanEMIEntity> {
    const emi = await this.prisma.loanEMI.findUnique({
      where: { id },
      include: { loan: true },
    });
    if (!emi) throw new NotFoundException(`EMI ${id} not found`);

    const fee = new Prisma.Decimal(lateFee);
    const updatedEmi = await this.repository.updateEMI(id, {
      status: EMIStatus.PAID,
      paidAt: new Date(),
      lateFee: fee,
    });

    // Update Loan remaining balance
    const nextBalance = emi.loan.remainingBalance.sub(emi.amount);
    await this.prisma.loan.update({
      where: { id: emi.loanId },
      data: {
        remainingBalance: nextBalance,
        version: { increment: 1 },
      },
    });

    await this.eventBus.publish(
      LoanUpdatedEventPayload.eventName,
      new LoanUpdatedEventPayload(emi.loanId, emi.loan.userId, nextBalance.toString(), emi.currency)
    );

    return this.mapEMIToEntity(updatedEmi);
  }

  // ─── Subscriptions Service ───

  async createSubscription(userId: string, dto: CreateSubscriptionDto): Promise<SubscriptionEntity> {
    const sub = await this.repository.createSubscription(userId, {
      name: dto.name,
      amount: new Prisma.Decimal(dto.amount),
      currency: dto.currency,
      cycle: dto.cycle,
      nextBilling: new Date(dto.nextBilling),
      trial: dto.trial,
      autoRenew: dto.autoRenew,
    });

    await this.eventBus.publish(
      SubscriptionCreatedEventPayload.eventName,
      new SubscriptionCreatedEventPayload(sub.id, userId, sub.name, sub.amount.toString(), sub.nextBilling)
    );

    return this.mapSubToEntity(sub);
  }

  async listSubscriptions(userId: string): Promise<SubscriptionEntity[]> {
    const list = await this.repository.listSubscriptions(userId);
    return list.map(s => this.mapSubToEntity(s));
  }

  // ─── Recurring Transactions Service ───

  async createRecurring(userId: string, dto: CreateRecurringTransactionDto): Promise<RecurringTransactionEntity> {
    const rec = await this.repository.createRecurring(userId, {
      type: dto.type,
      amount: new Prisma.Decimal(dto.amount),
      currency: dto.currency,
      description: dto.description,
      categoryId: dto.categoryId,
      accountId: dto.accountId,
      toAccountId: dto.toAccountId,
      frequency: dto.frequency,
      rrule: dto.rrule,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      maxOccurrences: dto.maxOccurrences,
    });

    await this.eventBus.publish(
      RecurringTransactionCreatedEventPayload.eventName,
      new RecurringTransactionCreatedEventPayload(
        rec.id,
        userId,
        rec.amount.toString(),
        rec.frequency,
        rec.startDate
      )
    );

    return this.mapRecurToEntity(rec);
  }

  async listRecurring(userId: string): Promise<RecurringTransactionEntity[]> {
    const list = await this.repository.listRecurring(userId);
    return list.map(r => this.mapRecurToEntity(r));
  }

  // ─── Internal helpers ───

  private async checkBudgetLimits(userId: string, categoryId: string | null, amount: Prisma.Decimal, currency: Currency) {
    if (!categoryId) return;
    const budgets = await this.repository.listBudgets(userId);
    const matchingBudgets = budgets.filter(b => b.categoryId === categoryId && b.currency === currency);

    for (const budget of matchingBudgets) {
      const txs = await this.prisma.transaction.findMany({
        where: {
          userId,
          categoryId,
          occurredAt: { gte: budget.startDate, lte: budget.endDate },
          type: TransactionType.EXPENSE,
          status: TransactionStatus.POSTED,
        },
      });

      let spent = new Prisma.Decimal(0.0);
      for (const t of txs) {
        spent = spent.add(t.amount.abs());
      }

      const totalNewSpent = spent.add(amount);
      if (totalNewSpent.greaterThan(budget.amount)) {
        await this.eventBus.publish(
          BudgetExceededEventPayload.eventName,
          new BudgetExceededEventPayload(
            budget.id,
            userId,
            categoryId,
            budget.amount.toString(),
            totalNewSpent.toString(),
            currency
          )
        );
      }
    }
  }

  private mapAccountToEntity(acc: any): AccountEntity {
    return new AccountEntity({
      id: acc.id,
      userId: acc.userId,
      name: acc.name,
      type: acc.type,
      allowNegativeBalance: acc.allowNegativeBalance,
      openingBalance: new Money(acc.openingBalance, acc.currency),
      currentBalance: new Money(acc.currentBalance, acc.currency),
      availableBalance: new Money(acc.availableBalance, acc.currency),
      createdAt: acc.createdAt,
      updatedAt: acc.updatedAt,
      version: acc.version,
    });
  }

  private mapTxToEntity(t: any): TransactionEntity {
    return new TransactionEntity({
      id: t.id,
      userId: t.userId,
      type: t.type,
      status: t.status,
      description: t.description,
      reference: t.reference,
      notes: t.notes,
      transferId: t.transferId,
      exchangeRate: t.exchangeRate.toString(),
      money: new Money(t.amount, t.currency),
      baseMoney: new Money(t.baseAmount, t.currency),
      categoryId: t.categoryId,
      accountId: t.accountId,
      toAccountId: t.toAccountId,
      recurringId: t.recurringId,
      occurredAt: t.occurredAt,
      postedAt: t.postedAt,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      version: t.version,
    });
  }

  private mapBudgetToEntity(b: any, spent: Prisma.Decimal): BudgetEntity {
    return new BudgetEntity({
      id: b.id,
      userId: b.userId,
      period: b.period,
      startDate: b.startDate,
      endDate: b.endDate,
      categoryId: b.categoryId,
      allocatedMoney: new Money(b.amount, b.currency),
      spentMoney: new Money(spent, b.currency),
      remainingMoney: new Money(b.amount.sub(spent), b.currency),
      progress: b.amount.isZero() ? 0 : parseFloat(spent.mul(100).div(b.amount).toFixed(2)),
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    });
  }

  private mapLoanToEntity(l: any): LoanEntity {
    return new LoanEntity({
      id: l.id,
      userId: l.userId,
      interestRate: l.interestRate.toString(),
      durationMonths: l.durationMonths,
      startDate: l.startDate,
      status: l.status,
      direction: l.direction,
      principalMoney: new Money(l.principal, l.currency),
      remainingBalanceMoney: new Money(l.remainingBalance, l.currency),
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      version: l.version,
    });
  }

  private mapEMIToEntity(e: any): LoanEMIEntity {
    return new LoanEMIEntity({
      id: e.id,
      loanId: e.loanId,
      dueDate: e.dueDate,
      status: e.status,
      installmentNumber: e.installmentNumber,
      remainingInstallments: e.remainingInstallments,
      paidAt: e.paidAt,
      money: new Money(e.amount, e.currency),
      lateFeeMoney: new Money(e.lateFee, e.currency),
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    });
  }

  private mapSubToEntity(s: any): SubscriptionEntity {
    return new SubscriptionEntity({
      id: s.id,
      userId: s.userId,
      name: s.name,
      cycle: s.cycle,
      nextBilling: s.nextBilling,
      status: s.status,
      trial: s.trial,
      autoRenew: s.autoRenew,
      cancelledAt: s.cancelledAt,
      money: new Money(s.amount, s.currency),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    });
  }

  private mapRecurToEntity(r: any): RecurringTransactionEntity {
    return new RecurringTransactionEntity({
      id: r.id,
      userId: r.userId,
      type: r.type,
      description: r.description,
      categoryId: r.categoryId,
      accountId: r.accountId,
      toAccountId: r.toAccountId,
      money: new Money(r.amount, r.currency),
      frequency: r.frequency,
      rrule: r.rrule,
      startDate: r.startDate,
      endDate: r.endDate,
      nextRun: r.nextRun,
      lastRun: r.lastRun,
      occurrenceCount: r.occurrenceCount,
      maxOccurrences: r.maxOccurrences,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      version: r.version,
    });
  }
}
