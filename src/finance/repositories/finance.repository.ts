import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, AccountType, TransactionType, TransactionStatus, Currency, BudgetPeriod, LoanStatus, LoanDirection, EMIStatus, SubscriptionStatus, FinancialGoalStatus, ReminderFrequency } from '@prisma/client';
import { randomUUID } from 'crypto';

@Injectable()
export class FinanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Accounts CRUD ───

  async createAccount(
    userId: string,
    data: {
      name: string;
      type: AccountType;
      currency: Currency;
      openingBalance: Prisma.Decimal;
      allowNegativeBalance: boolean;
    }
  ) {
    return this.prisma.account.create({
      data: {
        userId,
        name: data.name,
        type: data.type,
        currency: data.currency,
        openingBalance: data.openingBalance,
        currentBalance: data.openingBalance,
        availableBalance: data.openingBalance,
        allowNegativeBalance: data.allowNegativeBalance,
        version: 1,
      },
    });
  }

  async findAccountById(id: string) {
    return this.prisma.account.findUnique({
      where: { id },
    });
  }

  async listAccounts(userId: string) {
    return this.prisma.account.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  async updateAccount(
    id: string,
    currentVersion: number,
    data: {
      name?: string;
      type?: AccountType;
      openingBalance?: Prisma.Decimal;
      currentBalance?: Prisma.Decimal;
      availableBalance?: Prisma.Decimal;
      allowNegativeBalance?: boolean;
    }
  ) {
    const result = await this.prisma.account.updateMany({
      where: { id, version: currentVersion },
      data: {
        ...data,
        version: currentVersion + 1,
      },
    });

    if (result.count === 0) {
      throw new ConflictException('Optimistic concurrency lock failed: Account was updated by another request.');
    }

    return this.prisma.account.findUnique({ where: { id } });
  }

  // ─── Transactions CRUD & Balances & Ledger ───

  async findTransactionById(id: string) {
    return this.prisma.transaction.findUnique({
      where: { id },
      include: { account: true, category: true },
    });
  }

  async listTransactions(userId: string, filters: { accountId?: string; type?: TransactionType; status?: TransactionStatus; reference?: string }) {
    const where: any = { userId };
    if (filters.accountId) where.accountId = filters.accountId;
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.reference) where.reference = filters.reference;

    return this.prisma.transaction.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      include: { account: true, category: true },
    });
  }

  async createTransaction(
    userId: string,
    data: {
      type: TransactionType;
      status?: TransactionStatus;
      amount: Prisma.Decimal;
      currency: Currency;
      description: string;
      reference?: string;
      notes?: string;
      categoryId?: string;
      accountId: string;
      toAccountId?: string;
      exchangeRate?: Prisma.Decimal;
      occurredAt?: Date;
    }
  ) {
    return this.prisma.$transaction(async (tx) => {
      const occurred = data.occurredAt || new Date();
      const txStatus = data.status || TransactionStatus.POSTED;
      const rate = data.exchangeRate || new Prisma.Decimal(1.0);
      const baseAmount = data.amount.mul(rate);

      if (data.type === TransactionType.TRANSFER) {
        if (!data.toAccountId) {
          throw new BadRequestException('toAccountId is required for transfer transactions');
        }
        if (data.accountId === data.toAccountId) {
          throw new BadRequestException('Source and destination accounts must be different');
        }

        // Fetch both accounts
        const sourceAcc = await tx.account.findUnique({ where: { id: data.accountId } });
        const destAcc = await tx.account.findUnique({ where: { id: data.toAccountId } });

        if (!sourceAcc || sourceAcc.userId !== userId) {
          throw new BadRequestException('Source account not found');
        }
        if (!destAcc || destAcc.userId !== userId) {
          throw new BadRequestException('Destination account not found');
        }

        // Check source account balance policy
        const nextSourceAvailable = sourceAcc.availableBalance.sub(data.amount);
        if (nextSourceAvailable.isNegative() && !sourceAcc.allowNegativeBalance) {
          throw new BadRequestException('Transaction rejected: Insufficient funds in source account');
        }

        const transferId = randomUUID();

        // 1. Outflow transaction
        const sourceTx = await tx.transaction.create({
          data: {
            userId,
            type: TransactionType.TRANSFER,
            status: txStatus,
            amount: data.amount.neg(),
            currency: data.currency,
            description: data.description,
            reference: data.reference,
            notes: data.notes,
            transferId,
            exchangeRate: new Prisma.Decimal(1.0),
            baseAmount: data.amount.neg(),
            accountId: data.accountId,
            toAccountId: data.toAccountId,
            occurredAt: occurred,
            postedAt: txStatus === TransactionStatus.POSTED ? occurred : null,
          },
        });

        // 2. Inflow transaction (converted amount if currencies differ)
        const destAmount = data.amount.mul(rate);
        const destTx = await tx.transaction.create({
          data: {
            userId,
            type: TransactionType.TRANSFER,
            status: txStatus,
            amount: destAmount,
            currency: destAcc.currency,
            description: data.description,
            reference: data.reference,
            notes: data.notes,
            transferId,
            exchangeRate: rate,
            baseAmount: destAmount,
            accountId: data.toAccountId,
            occurredAt: occurred,
            postedAt: txStatus === TransactionStatus.POSTED ? occurred : null,
          },
        });

        // 3. Update account balances
        if (txStatus === TransactionStatus.POSTED) {
          await tx.account.update({
            where: { id: sourceAcc.id },
            data: {
              currentBalance: sourceAcc.currentBalance.sub(data.amount),
              availableBalance: sourceAcc.availableBalance.sub(data.amount),
              version: { increment: 1 },
            },
          });

          await tx.account.update({
            where: { id: destAcc.id },
            data: {
              currentBalance: destAcc.currentBalance.add(destAmount),
              availableBalance: destAcc.availableBalance.add(destAmount),
              version: { increment: 1 },
            },
          });

          // Ledger Entry
          await tx.ledgerEntry.create({
            data: {
              userId,
              accountId: sourceAcc.id,
              transactionId: sourceTx.id,
              amount: data.amount.neg(),
              type: 'CREDIT',
              description: `Transfer Outflow: ${data.description}`,
            },
          });

          await tx.ledgerEntry.create({
            data: {
              userId,
              accountId: destAcc.id,
              transactionId: destTx.id,
              amount: destAmount,
              type: 'DEBIT',
              description: `Transfer Inflow: ${data.description}`,
            },
          });
        }

        return sourceTx;
      } else {
        // NON-TRANSFER transaction (INCOME, EXPENSE, etc.)
        const acc = await tx.account.findUnique({ where: { id: data.accountId } });
        if (!acc || acc.userId !== userId) {
          throw new BadRequestException('Account not found');
        }

        let isOutflow = data.type === TransactionType.EXPENSE;
        if (data.type === TransactionType.ADJUSTMENT && data.amount.isNegative()) {
          isOutflow = true;
        }

        if (isOutflow) {
          const absoluteAmount = data.amount.abs();
          const nextAvailable = acc.availableBalance.sub(absoluteAmount);
          if (nextAvailable.isNegative() && !acc.allowNegativeBalance) {
            throw new BadRequestException('Transaction rejected: Insufficient funds in account');
          }
        }

        // Create transaction row
        const newTx = await tx.transaction.create({
          data: {
            userId,
            type: data.type,
            status: txStatus,
            amount: data.amount,
            currency: data.currency,
            description: data.description,
            reference: data.reference,
            notes: data.notes,
            exchangeRate: rate,
            baseAmount,
            accountId: data.accountId,
            categoryId: data.categoryId || null,
            occurredAt: occurred,
            postedAt: txStatus === TransactionStatus.POSTED ? occurred : null,
          },
        });

        // Update account balance
        if (txStatus === TransactionStatus.POSTED) {
          await tx.account.update({
            where: { id: acc.id },
            data: {
              currentBalance: acc.currentBalance.add(data.amount),
              availableBalance: acc.availableBalance.add(data.amount),
              version: { increment: 1 },
            },
          });

          // Ledger Entry
          const ledgerType = data.amount.isNegative() ? 'CREDIT' : 'DEBIT';
          await tx.ledgerEntry.create({
            data: {
              userId,
              accountId: acc.id,
              transactionId: newTx.id,
              amount: data.amount,
              type: ledgerType,
              description: data.description,
            },
          });
        }

        return newTx;
      }
    });
  }

  // ─── Categories CRUD ───

  async createCategory(
    userId: string,
    data: {
      name: string;
      parentId?: string | null;
      sortOrder?: number;
      isFavorite?: boolean;
    }
  ) {
    return this.prisma.expenseCategory.create({
      data: {
        userId,
        name: data.name,
        parentId: data.parentId || null,
        sortOrder: data.sortOrder || 0,
        isFavorite: data.isFavorite || false,
      },
    });
  }

  async listCategories(userId: string) {
    return this.prisma.expenseCategory.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  // ─── Budgets CRUD ───

  async createBudget(
    userId: string,
    data: {
      amount: Prisma.Decimal;
      currency: Currency;
      period: BudgetPeriod;
      startDate: Date;
      endDate: Date;
      categoryId?: string | null;
    }
  ) {
    return this.prisma.budget.create({
      data: {
        userId,
        amount: data.amount,
        currency: data.currency,
        period: data.period,
        startDate: data.startDate,
        endDate: data.endDate,
        categoryId: data.categoryId || null,
      },
    });
  }

  async listBudgets(userId: string) {
    return this.prisma.budget.findMany({
      where: { userId },
      include: { category: true },
    });
  }

  // ─── Loans CRUD ───

  async createLoan(
    userId: string,
    data: {
      principal: Prisma.Decimal;
      currency: Currency;
      interestRate: Prisma.Decimal;
      durationMonths: number;
      startDate: Date;
      direction: LoanDirection;
    }
  ) {
    return this.prisma.loan.create({
      data: {
        userId,
        principal: data.principal,
        currency: data.currency,
        interestRate: data.interestRate,
        durationMonths: data.durationMonths,
        startDate: data.startDate,
        direction: data.direction,
        remainingBalance: data.principal,
      },
    });
  }

  async listLoans(userId: string) {
    return this.prisma.loan.findMany({
      where: { userId },
      include: { emis: true },
    });
  }

  async findLoanById(id: string) {
    return this.prisma.loan.findUnique({
      where: { id },
      include: { emis: true },
    });
  }

  async createEMI(
    loanId: string,
    data: {
      amount: Prisma.Decimal;
      currency: Currency;
      dueDate: Date;
      installmentNumber: number;
      remainingInstallments: number;
    }
  ) {
    return this.prisma.loanEMI.create({
      data: {
        loanId,
        amount: data.amount,
        currency: data.currency,
        dueDate: data.dueDate,
        installmentNumber: data.installmentNumber,
        remainingInstallments: data.remainingInstallments,
      },
    });
  }

  async updateEMI(
    id: string,
    data: {
      status?: EMIStatus;
      paidAt?: Date;
      lateFee?: Prisma.Decimal;
    }
  ) {
    return this.prisma.loanEMI.update({
      where: { id },
      data,
    });
  }

  // ─── Subscriptions CRUD ───

  async createSubscription(
    userId: string,
    data: {
      name: string;
      amount: Prisma.Decimal;
      currency: Currency;
      cycle: string;
      nextBilling: Date;
      trial?: boolean;
      autoRenew?: boolean;
    }
  ) {
    return this.prisma.subscription.create({
      data: {
        userId,
        name: data.name,
        amount: data.amount,
        currency: data.currency,
        cycle: data.cycle,
        nextBilling: data.nextBilling,
        trial: data.trial || false,
        autoRenew: data.autoRenew ?? true,
      },
    });
  }

  async listSubscriptions(userId: string) {
    return this.prisma.subscription.findMany({
      where: { userId },
    });
  }

  // ─── Recurring Transactions CRUD ───

  async createRecurring(
    userId: string,
    data: {
      type: TransactionType;
      amount: Prisma.Decimal;
      currency: Currency;
      description: string;
      categoryId?: string | null;
      accountId: string;
      toAccountId?: string | null;
      frequency: ReminderFrequency;
      rrule?: string | null;
      startDate: Date;
      endDate?: Date | null;
      maxOccurrences?: number | null;
    }
  ) {
    return this.prisma.recurringTransaction.create({
      data: {
        userId,
        type: data.type,
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        categoryId: data.categoryId || null,
        accountId: data.accountId,
        toAccountId: data.toAccountId || null,
        frequency: data.frequency,
        rrule: data.rrule,
        startDate: data.startDate,
        endDate: data.endDate || null,
        maxOccurrences: data.maxOccurrences || null,
        nextRun: data.startDate,
      },
    });
  }

  async listRecurring(userId: string) {
    return this.prisma.recurringTransaction.findMany({
      where: { userId },
    });
  }
}
