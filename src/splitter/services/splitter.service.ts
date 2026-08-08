import { Injectable, BadRequestException, NotFoundException, Inject, ForbiddenException } from '@nestjs/common';
import { Currency, GroupStatus, MemberStatus, ExpenseStatus, SettlementStatus, SplitType, Prisma } from '@prisma/client';
import { SplitterRepository } from '../repositories/splitter.repository';
import { SplitBalanceService } from './split-balance.service';
import { DebtSimplificationService } from './debt-simplification.service';
import { IEventBus } from '../../telegram/interfaces/event-bus.interface';
import {
  SplitGroupCreatedEvent,
  SplitGroupUpdatedEvent,
  SplitMemberAddedEvent,
  SplitMemberRemovedEvent,
  GroupExpenseCreatedEvent,
  GroupExpenseUpdatedEvent,
  GroupExpenseVoidedEvent,
  SettlementCreatedEvent,
  SettlementCompletedEvent,
  SettlementCancelledEvent,
  GroupBalanceChangedEvent,
} from '../events/splitter-events';
import { CustomLogger } from '../../common/logger/custom-logger.service';
import { OutboxService } from '../../events/services/outbox.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SplitterService {
  constructor(
    private readonly repository: SplitterRepository,
    private readonly balanceService: SplitBalanceService,
    private readonly debtService: DebtSimplificationService,
    @Inject(IEventBus) private readonly eventBus: IEventBus,
    private readonly logger: CustomLogger,
    private readonly outboxService: OutboxService,
    private readonly prisma: PrismaService
  ) {
    this.logger.setContext('SplitterService');
  }

  // ─── Verification helper ───
  private async checkGroupMembership(userId: string, groupId: string): Promise<void> {
    const member = await this.repository.findMemberByUserId(groupId, userId);
    if (!member || member.status !== MemberStatus.ACTIVE) {
      throw new ForbiddenException('User is not an active member of this group.');
    }
  }

  // ─── Group ───
  async createGroup(userId: string, data: { name: string; description?: string; defaultCurrency?: Currency; icon?: string }) {
    const group = await this.repository.createGroup({
      ownerId: userId,
      name: data.name,
      description: data.description,
      defaultCurrency: data.defaultCurrency || Currency.USD,
      icon: data.icon,
      createdBy: userId,
    });

    if (!group) throw new BadRequestException('Failed to create group');

    await this.eventBus.publish(
      SplitGroupCreatedEvent.eventName,
      new SplitGroupCreatedEvent(group.id, userId, group)
    );

    return group;
  }

  async getGroup(userId: string, id: string) {
    await this.checkGroupMembership(userId, id);
    const group = await this.repository.findGroupById(id);
    if (!group) throw new NotFoundException(`Group ${id} not found`);
    return group;
  }

  async listGroups(userId: string) {
    return this.repository.listGroups(userId);
  }

  async updateGroup(userId: string, id: string, version: number, data: { name?: string; description?: string; defaultCurrency?: Currency; icon?: string }) {
    await this.checkGroupMembership(userId, id);
    const group = await this.repository.updateGroup(id, version, {
      ...data,
      updatedBy: userId,
    });

    await this.eventBus.publish(
      SplitGroupUpdatedEvent.eventName,
      new SplitGroupUpdatedEvent(id, userId, group)
    );

    return group;
  }

  async archiveGroup(userId: string, id: string, version: number) {
    await this.checkGroupMembership(userId, id);
    const group = await this.repository.updateGroup(id, version, {
      status: GroupStatus.ARCHIVED,
      updatedBy: userId,
    });

    await this.eventBus.publish(
      SplitGroupUpdatedEvent.eventName,
      new SplitGroupUpdatedEvent(id, userId, group)
    );

    return group;
  }

  // ─── Members ───
  async addMember(
    userId: string,
    groupId: string,
    data: { userId?: string; displayName: string; email?: string; phone?: string }
  ) {
    await this.checkGroupMembership(userId, groupId);
    
    // Check if user is already a member
    if (data.userId) {
      const existing = await this.repository.findMemberByUserId(groupId, data.userId);
      if (existing) {
        if (existing.status === MemberStatus.ACTIVE) {
          throw new BadRequestException('User is already an active member of this group.');
        }
        const reactivated = await this.repository.updateMember(existing.id, existing.version, {
          status: MemberStatus.ACTIVE,
          displayName: data.displayName,
          email: data.email || existing.email || undefined,
          phone: data.phone || existing.phone || undefined,
          updatedBy: userId,
        });

        if (!reactivated) {
          throw new BadRequestException('Failed to reactivate member');
        }

        await this.eventBus.publish(
          SplitMemberAddedEvent.eventName,
          new SplitMemberAddedEvent(groupId, reactivated.id, userId, reactivated)
        );

        return reactivated;
      }
    }

    const member = await this.repository.addMember(groupId, {
      ...data,
      createdBy: userId,
    });

    await this.eventBus.publish(
      SplitMemberAddedEvent.eventName,
      new SplitMemberAddedEvent(groupId, member.id, userId, member)
    );

    return member;
  }

  async listMembers(userId: string, groupId: string) {
    await this.checkGroupMembership(userId, groupId);
    return this.repository.listMembers(groupId);
  }

  async removeMember(userId: string, groupId: string, memberId: string) {
    await this.checkGroupMembership(userId, groupId);
    
    const member = await this.repository.findMemberById(memberId);
    if (!member || member.groupId !== groupId) {
      throw new NotFoundException(`Member ${memberId} not found in this group`);
    }

    if (member.status !== MemberStatus.ACTIVE) {
      throw new BadRequestException('Member is not active');
    }

    // Check if member has outstanding balances
    const balances = await this.balanceService.calculateBalances(groupId);
    const mBal = balances.find(b => b.memberId === memberId);
    if (mBal && !mBal.netBalance.isZero()) {
      throw new BadRequestException('Cannot remove member with outstanding debt or balance.');
    }

    const updated = await this.repository.updateMember(memberId, member.version, {
      status: MemberStatus.REMOVED,
      leftAt: new Date(),
      updatedBy: userId,
    });

    await this.eventBus.publish(
      SplitMemberRemovedEvent.eventName,
      new SplitMemberRemovedEvent(groupId, memberId, userId, updated)
    );

    return updated;
  }

  // ─── Expenses ───
  async createExpense(
    userId: string,
    groupId: string,
    dto: {
      description: string;
      currency: Currency;
      totalAmount: string;
      expenseDate?: string;
      categoryId?: string;
      notes?: string;
      splitType: SplitType;
      payers: { memberId: string; amountPaid: string }[];
      participants: { memberId: string; owedAmount?: string; percentage?: string; shares?: string }[];
    }
  ) {
    await this.checkGroupMembership(userId, groupId);

    const group = await this.repository.findGroupById(groupId);
    if (!group) throw new NotFoundException(`Group ${groupId} not found`);

    // Verify creator is in group roster
    const creatorMember = await this.repository.findMemberByUserId(groupId, userId);
    if (!creatorMember || creatorMember.status !== MemberStatus.ACTIVE) {
      throw new BadRequestException('Creator must be an active member of the group');
    }

    const total = new Prisma.Decimal(dto.totalAmount);
    if (total.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Total amount must be greater than zero.');
    }

    // Validation duplicate IDs
    const payerIds = dto.payers.map(p => p.memberId);
    if (new Set(payerIds).size !== payerIds.length) {
      throw new BadRequestException('Duplicate payer IDs are not allowed.');
    }

    const participantIds = dto.participants.map(p => p.memberId);
    if (new Set(participantIds).size !== participantIds.length) {
      throw new BadRequestException('Duplicate participant IDs are not allowed.');
    }

    // Check currency matches group policy
    if (group.defaultCurrency !== dto.currency) {
      throw new BadRequestException(`Currency must match group currency: ${group.defaultCurrency}`);
    }

    // Validate payers belong to group active roster
    const groupMembers = await this.repository.listMembers(groupId);
    const memberMap = new Map(groupMembers.map(m => [m.id, m]));

    for (const p of dto.payers) {
      const m = memberMap.get(p.memberId);
      if (!m || m.status !== MemberStatus.ACTIVE) {
        throw new BadRequestException(`Payer ${p.memberId} is not an active member of this group.`);
      }
    }

    for (const p of dto.participants) {
      const m = memberMap.get(p.memberId);
      if (!m || m.status !== MemberStatus.ACTIVE) {
        throw new BadRequestException(`Participant ${p.memberId} is not an active member of this group.`);
      }
    }

    // Validate Payers Sum
    let sumPayers = new Prisma.Decimal(0);
    const resolvedPayers = dto.payers.map(p => {
      const amt = new Prisma.Decimal(p.amountPaid);
      if (amt.isNegative()) throw new BadRequestException('Payer amount cannot be negative');
      sumPayers = sumPayers.add(amt);
      return { memberId: p.memberId, amountPaid: amt };
    });

    if (!sumPayers.equals(total)) {
      throw new BadRequestException(`Payer contributions (${sumPayers.toString()}) do not sum to total amount (${total.toString()}).`);
    }

    // Process Splits & Calculate Owed Amounts
    const resolvedParticipants: { memberId: string; owedAmount: Prisma.Decimal; percentage?: Prisma.Decimal; shares?: Prisma.Decimal }[] = [];

    if (dto.splitType === SplitType.EQUAL) {
      const N = dto.participants.length;
      if (N === 0) throw new BadRequestException('No participants provided for equal split.');
      
      const amountPerParticipant = total.div(N).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
      let sumAllocated = amountPerParticipant.mul(N);
      let remainder = total.sub(sumAllocated);

      // Sort deterministically to distribute remainder
      const sortedParts = [...dto.participants].sort((a, b) => a.memberId.localeCompare(b.memberId));

      for (const p of sortedParts) {
        let owed = amountPerParticipant;
        if (remainder.greaterThan(0)) {
          owed = owed.add('0.01');
          remainder = remainder.sub('0.01');
        }
        resolvedParticipants.push({ memberId: p.memberId, owedAmount: owed });
      }
    } else if (dto.splitType === SplitType.EXACT) {
      let sumOwed = new Prisma.Decimal(0);
      for (const p of dto.participants) {
        if (!p.owedAmount) throw new BadRequestException(`Owed amount required for participant ${p.memberId} in EXACT split.`);
        const owed = new Prisma.Decimal(p.owedAmount);
        if (owed.isNegative()) throw new BadRequestException('Owed amount cannot be negative.');
        sumOwed = sumOwed.add(owed);
        resolvedParticipants.push({ memberId: p.memberId, owedAmount: owed });
      }

      if (!sumOwed.equals(total)) {
        throw new BadRequestException(`Participant owed amounts (${sumOwed.toString()}) do not sum to total amount (${total.toString()}).`);
      }
    } else if (dto.splitType === SplitType.PERCENTAGE) {
      let sumPct = new Prisma.Decimal(0);
      const sortedParts = [...dto.participants].sort((a, b) => a.memberId.localeCompare(b.memberId));

      // Validate percentage sum
      for (const p of sortedParts) {
        if (!p.percentage) throw new BadRequestException(`Percentage required for participant ${p.memberId} in PERCENTAGE split.`);
        const pct = new Prisma.Decimal(p.percentage);
        if (pct.isNegative()) throw new BadRequestException('Percentage cannot be negative.');
        sumPct = sumPct.add(pct);
      }

      if (!sumPct.equals(100)) {
        throw new BadRequestException(`Percentages (${sumPct.toString()}) must sum to exactly 100.`);
      }

      let sumAllocated = new Prisma.Decimal(0);
      const tempOwed: { memberId: string; owedAmount: Prisma.Decimal; percentage: Prisma.Decimal }[] = [];

      for (const p of sortedParts) {
        const pct = new Prisma.Decimal(p.percentage!);
        const owed = total.mul(pct).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
        sumAllocated = sumAllocated.add(owed);
        tempOwed.push({ memberId: p.memberId, owedAmount: owed, percentage: pct });
      }

      let remainder = total.sub(sumAllocated);
      for (const t of tempOwed) {
        let owed = t.owedAmount;
        if (remainder.greaterThan(0)) {
          owed = owed.add('0.01');
          remainder = remainder.sub('0.01');
        }
        resolvedParticipants.push({ memberId: t.memberId, owedAmount: owed, percentage: t.percentage });
      }
    } else if (dto.splitType === SplitType.SHARES) {
      let totalShares = new Prisma.Decimal(0);
      const sortedParts = [...dto.participants].sort((a, b) => a.memberId.localeCompare(b.memberId));

      for (const p of sortedParts) {
        if (!p.shares) throw new BadRequestException(`Shares required for participant ${p.memberId} in SHARES split.`);
        const sh = new Prisma.Decimal(p.shares);
        if (sh.lessThanOrEqualTo(0)) throw new BadRequestException('Shares must be greater than zero.');
        totalShares = totalShares.add(sh);
      }

      let sumAllocated = new Prisma.Decimal(0);
      const tempOwed: { memberId: string; owedAmount: Prisma.Decimal; shares: Prisma.Decimal }[] = [];

      for (const p of sortedParts) {
        const sh = new Prisma.Decimal(p.shares!);
        const owed = total.mul(sh).div(totalShares).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
        sumAllocated = sumAllocated.add(owed);
        tempOwed.push({ memberId: p.memberId, owedAmount: owed, shares: sh });
      }

      let remainder = total.sub(sumAllocated);
      for (const t of tempOwed) {
        let owed = t.owedAmount;
        if (remainder.greaterThan(0)) {
          owed = owed.add('0.01');
          remainder = remainder.sub('0.01');
        }
        resolvedParticipants.push({ memberId: t.memberId, owedAmount: owed, shares: t.shares });
      }
    }

    const expense = await this.repository.createExpense(
      groupId,
      {
        createdBy: creatorMember.id,
        description: dto.description,
        currency: dto.currency,
        totalAmount: total,
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
        categoryId: dto.categoryId,
        notes: dto.notes,
      },
      resolvedPayers,
      resolvedParticipants,
      dto.splitType
    );

    if (!expense) throw new BadRequestException('Failed to create expense');

    await this.eventBus.publish(
      GroupExpenseCreatedEvent.eventName,
      new GroupExpenseCreatedEvent(groupId, expense.id, userId, expense)
    );

    await this.eventBus.publish(
      GroupBalanceChangedEvent.eventName,
      new GroupBalanceChangedEvent(groupId, userId)
    );

    return expense;
  }

  async getExpense(userId: string, groupId: string, expenseId: string) {
    await this.checkGroupMembership(userId, groupId);
    const exp = await this.repository.findExpenseById(expenseId);
    if (!exp || exp.groupId !== groupId) throw new NotFoundException(`Expense ${expenseId} not found in this group`);
    return exp;
  }

  async listExpenses(userId: string, groupId: string) {
    await this.checkGroupMembership(userId, groupId);
    return this.repository.listExpenses(groupId);
  }

  async updateExpense(
    userId: string,
    groupId: string,
    expenseId: string,
    version: number,
    dto: {
      description?: string;
      totalAmount?: string;
      currency?: Currency;
      expenseDate?: string;
      categoryId?: string;
      notes?: string;
      splitType?: SplitType;
      payers?: { memberId: string; amountPaid: string }[];
      participants?: { memberId: string; owedAmount?: string; percentage?: string; shares?: string }[];
    }
  ) {
    await this.checkGroupMembership(userId, groupId);

    const exp = await this.repository.findExpenseById(expenseId);
    if (!exp || exp.groupId !== groupId) throw new NotFoundException(`Expense ${expenseId} not found in this group`);

    const creatorMember = await this.repository.findMemberByUserId(groupId, userId);
    if (!creatorMember || creatorMember.status !== MemberStatus.ACTIVE) {
      throw new BadRequestException('Actor must be an active member of this group');
    }

    const total = dto.totalAmount ? new Prisma.Decimal(dto.totalAmount) : exp.totalAmount;
    if (total.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Total amount must be greater than zero.');
    }

    const currency = dto.currency || exp.currency;

    let resolvedPayers: { memberId: string; amountPaid: Prisma.Decimal }[] | undefined = undefined;
    if (dto.payers) {
      const payerIds = dto.payers.map(p => p.memberId);
      if (new Set(payerIds).size !== payerIds.length) throw new BadRequestException('Duplicate payers not allowed.');

      let sumPayers = new Prisma.Decimal(0);
      resolvedPayers = dto.payers.map(p => {
        const amt = new Prisma.Decimal(p.amountPaid);
        sumPayers = sumPayers.add(amt);
        return { memberId: p.memberId, amountPaid: amt };
      });

      if (!sumPayers.equals(total)) {
        throw new BadRequestException('Payer contributions do not sum to total amount.');
      }
    }

    let resolvedParticipants: { memberId: string; owedAmount: Prisma.Decimal; percentage?: Prisma.Decimal; shares?: Prisma.Decimal }[] | undefined = undefined;
    if (dto.participants) {
      const participantIds = dto.participants.map(p => p.memberId);
      if (new Set(participantIds).size !== participantIds.length) throw new BadRequestException('Duplicate participants not allowed.');

      resolvedParticipants = [];
      const splitType = dto.splitType || (exp as any).splitType;

      if (splitType === SplitType.EQUAL) {
        const N = dto.participants.length;
        if (N === 0) throw new BadRequestException('No participants provided.');

        const amountPerParticipant = total.div(N).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
        let sumAllocated = amountPerParticipant.mul(N);
        let remainder = total.sub(sumAllocated);
        const sortedParts = [...dto.participants].sort((a, b) => a.memberId.localeCompare(b.memberId));

        for (const p of sortedParts) {
          let owed = amountPerParticipant;
          if (remainder.greaterThan(0)) {
            owed = owed.add('0.01');
            remainder = remainder.sub('0.01');
          }
          resolvedParticipants.push({ memberId: p.memberId, owedAmount: owed });
        }
      } else if (splitType === SplitType.EXACT) {
        let sumOwed = new Prisma.Decimal(0);
        for (const p of dto.participants) {
          if (!p.owedAmount) throw new BadRequestException('Owed amount required.');
          const owed = new Prisma.Decimal(p.owedAmount);
          sumOwed = sumOwed.add(owed);
          resolvedParticipants.push({ memberId: p.memberId, owedAmount: owed });
        }
        if (!sumOwed.equals(total)) throw new BadRequestException('Participant owed amounts do not sum to total.');
      } else if (splitType === SplitType.PERCENTAGE) {
        let sumPct = new Prisma.Decimal(0);
        const sortedParts = [...dto.participants].sort((a, b) => a.memberId.localeCompare(b.memberId));
        for (const p of sortedParts) {
          if (!p.percentage) throw new BadRequestException('Percentage required.');
          sumPct = sumPct.add(new Prisma.Decimal(p.percentage));
        }
        if (!sumPct.equals(100)) throw new BadRequestException('Percentages must sum to exactly 100.');

        let sumAllocated = new Prisma.Decimal(0);
        const tempOwed: any[] = [];
        for (const p of sortedParts) {
          const pct = new Prisma.Decimal(p.percentage!);
          const owed = total.mul(pct).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
          sumAllocated = sumAllocated.add(owed);
          tempOwed.push({ memberId: p.memberId, owedAmount: owed, percentage: pct });
        }
        let remainder = total.sub(sumAllocated);
        for (const t of tempOwed) {
          let owed = t.owedAmount;
          if (remainder.greaterThan(0)) {
            owed = owed.add('0.01');
            remainder = remainder.sub('0.01');
          }
          resolvedParticipants.push({ memberId: t.memberId, owedAmount: owed, percentage: t.percentage });
        }
      } else if (splitType === SplitType.SHARES) {
        let totalShares = new Prisma.Decimal(0);
        const sortedParts = [...dto.participants].sort((a, b) => a.memberId.localeCompare(b.memberId));
        for (const p of sortedParts) {
          if (!p.shares) throw new BadRequestException('Shares required.');
          totalShares = totalShares.add(new Prisma.Decimal(p.shares));
        }
        if (totalShares.lessThanOrEqualTo(0)) throw new BadRequestException('Shares must be positive.');

        let sumAllocated = new Prisma.Decimal(0);
        const tempOwed: any[] = [];
        for (const p of sortedParts) {
          const sh = new Prisma.Decimal(p.shares!);
          const owed = total.mul(sh).div(totalShares).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
          sumAllocated = sumAllocated.add(owed);
          tempOwed.push({ memberId: p.memberId, owedAmount: owed, shares: sh });
        }
        let remainder = total.sub(sumAllocated);
        for (const t of tempOwed) {
          let owed = t.owedAmount;
          if (remainder.greaterThan(0)) {
            owed = owed.add('0.01');
            remainder = remainder.sub('0.01');
          }
          resolvedParticipants.push({ memberId: t.memberId, owedAmount: owed, shares: t.shares });
        }
      }
    }

    const updated = await this.repository.updateExpense(
      expenseId,
      version,
      {
        description: dto.description,
        totalAmount: dto.totalAmount ? total : undefined,
        currency: dto.currency,
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
        categoryId: dto.categoryId,
        notes: dto.notes,
        updatedBy: creatorMember.id,
      },
      resolvedPayers,
      resolvedParticipants,
      dto.splitType
    );

    await this.eventBus.publish(
      GroupExpenseUpdatedEvent.eventName,
      new GroupExpenseUpdatedEvent(groupId, expenseId, userId, updated)
    );

    await this.eventBus.publish(
      GroupBalanceChangedEvent.eventName,
      new GroupBalanceChangedEvent(groupId, userId)
    );

    return updated;
  }

  async voidExpense(userId: string, groupId: string, expenseId: string) {
    await this.checkGroupMembership(userId, groupId);

    const exp = await this.repository.findExpenseById(expenseId);
    if (!exp || exp.groupId !== groupId) throw new NotFoundException(`Expense ${expenseId} not found`);

    const creatorMember = await this.repository.findMemberByUserId(groupId, userId);
    if (!creatorMember || creatorMember.status !== MemberStatus.ACTIVE) {
      throw new BadRequestException('Actor must be an active member');
    }

    const updated = await this.repository.updateExpense(expenseId, exp.version, {
      status: ExpenseStatus.VOIDED,
      updatedBy: creatorMember.id,
    });

    await this.eventBus.publish(
      GroupExpenseVoidedEvent.eventName,
      new GroupExpenseVoidedEvent(groupId, expenseId, userId, updated)
    );

    await this.eventBus.publish(
      GroupBalanceChangedEvent.eventName,
      new GroupBalanceChangedEvent(groupId, userId)
    );

    return updated;
  }

  // ─── Balances & Debt Graph ───
  async getBalances(userId: string, groupId: string) {
    await this.checkGroupMembership(userId, groupId);
    return this.balanceService.calculateBalances(groupId);
  }

  async getSimplifiedDebts(userId: string, groupId: string) {
    await this.checkGroupMembership(userId, groupId);
    const balances = await this.balanceService.calculateBalances(groupId);
    return this.debtService.simplifyDebts(balances);
  }

  // ─── Settlements ───
  async createSettlement(
    userId: string,
    groupId: string,
    dto: {
      payerMemberId: string;
      receiverMemberId: string;
      amount: string;
      currency: Currency;
      notes?: string;
      idempotencyKey?: string;
      syncToFinance?: boolean;
    }
  ) {
    await this.checkGroupMembership(userId, groupId);

    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.repository.findSettlementByIdempotencyKey(dto.idempotencyKey);
      if (existing) {
        this.logger.log(`Duplicate settlement request detected for idempotency key: ${dto.idempotencyKey}. Returning existing settlement.`);
        return existing;
      }
    }

    const payer = await this.repository.findMemberById(dto.payerMemberId);
    const receiver = await this.repository.findMemberById(dto.receiverMemberId);

    if (!payer || payer.groupId !== groupId || payer.status !== MemberStatus.ACTIVE) {
      throw new BadRequestException('Payer must be an active member of this group.');
    }
    if (!receiver || receiver.groupId !== groupId || receiver.status !== MemberStatus.ACTIVE) {
      throw new BadRequestException('Receiver must be an active member of this group.');
    }

    if (payer.id === receiver.id) {
      throw new BadRequestException('Payer and receiver cannot be the same member.');
    }

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Settlement amount must be greater than zero.');
    }

    // Verify amount does not exceed outstanding debt (strict verification)
    const balances = await this.balanceService.calculateBalances(groupId);
    const debts = this.debtService.simplifyDebts(balances);
    const outstanding = debts.find(
      d => d.fromMemberId === dto.payerMemberId && d.toMemberId === dto.receiverMemberId
    )?.amount || new Prisma.Decimal(0);

    if (amount.greaterThan(outstanding)) {
      throw new BadRequestException(`Settlement amount (${amount.toString()}) exceeds outstanding debt (${outstanding.toString()}).`);
    }

    const settlement = await this.repository.createSettlement({
      groupId,
      payerMemberId: dto.payerMemberId,
      receiverMemberId: dto.receiverMemberId,
      amount,
      currency: dto.currency,
      notes: dto.notes,
      idempotencyKey: dto.idempotencyKey,
      syncToFinance: dto.syncToFinance || false,
      createdBy: userId,
    });

    await this.eventBus.publish(
      SettlementCreatedEvent.eventName,
      new SettlementCreatedEvent(groupId, settlement.id, userId, settlement)
    );

    return settlement;
  }

  async completeSettlement(userId: string, groupId: string, settlementId: string, version: number) {
    await this.checkGroupMembership(userId, groupId);

    const set = await this.repository.findSettlementById(settlementId);
    if (!set || set.groupId !== groupId) throw new NotFoundException(`Settlement ${settlementId} not found in this group`);

    if (set.status !== SettlementStatus.PENDING) {
      throw new BadRequestException(`Settlement is already ${set.status}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const completed = await this.repository.updateSettlement(settlementId, version, {
        status: SettlementStatus.COMPLETED,
        settledAt: new Date(),
      }, tx);

      // Publish completed event via Outbox
      await this.outboxService.publish({
        eventName: SettlementCompletedEvent.eventName,
        aggregateType: 'Settlement',
        aggregateId: settlementId,
        userId,
        payload: new SettlementCompletedEvent(groupId, settlementId, userId, completed),
      }, tx);

      // Publish ephemeral event
      await this.eventBus.publish(
        GroupBalanceChangedEvent.eventName,
        new GroupBalanceChangedEvent(groupId, userId)
      ).catch(err => this.logger.error(`Failed to publish GroupBalanceChangedEvent: ${err.message}`));

      return completed;
    });
  }

  async cancelSettlement(userId: string, groupId: string, settlementId: string, version: number, notes?: string) {
    await this.checkGroupMembership(userId, groupId);

    const set = await this.repository.findSettlementById(settlementId);
    if (!set || set.groupId !== groupId) throw new NotFoundException(`Settlement ${settlementId} not found in this group`);

    if (set.status !== SettlementStatus.PENDING) {
      throw new BadRequestException(`Settlement is already ${set.status}`);
    }

    const cancelled = await this.repository.updateSettlement(settlementId, version, {
      status: SettlementStatus.CANCELLED,
      notes: notes || set.notes || undefined,
    });

    await this.eventBus.publish(
      SettlementCancelledEvent.eventName,
      new SettlementCancelledEvent(groupId, settlementId, userId, cancelled)
    );

    return cancelled;
  }

  async listSettlements(userId: string, groupId: string) {
    await this.checkGroupMembership(userId, groupId);
    return this.repository.listSettlements(groupId);
  }
}
