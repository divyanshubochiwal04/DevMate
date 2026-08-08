import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Currency, GroupStatus, MemberStatus, ExpenseStatus, SettlementStatus, SplitType, Prisma } from '@prisma/client';

@Injectable()
export class SplitterRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Group ───
  async createGroup(data: {
    ownerId?: string;
    name: string;
    description?: string;
    defaultCurrency?: Currency;
    icon?: string;
    createdBy?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      // Create group
      const group = await tx.splitGroup.create({
        data: {
          ...data,
          status: GroupStatus.ACTIVE,
          version: 1,
        },
      });

      // If owner is registered user, automatically add them as an ACTIVE member
      if (data.ownerId) {
        // Resolve user display name
        const user = await tx.user.findUnique({ where: { id: data.ownerId } });
        const displayName = user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Owner';
        await tx.splitMember.create({
          data: {
            groupId: group.id,
            userId: data.ownerId,
            displayName,
            status: MemberStatus.ACTIVE,
            createdBy: data.createdBy,
            version: 1,
          },
        });
      }

      return tx.splitGroup.findUnique({
        where: { id: group.id },
        include: { members: true },
      });
    });
  }

  async findGroupById(id: string) {
    return this.prisma.splitGroup.findFirst({
      where: { id, deletedAt: null },
      include: {
        members: { where: { deletedAt: null } },
      },
    });
  }

  async listGroups(userId: string) {
    return this.prisma.splitGroup.findMany({
      where: {
        deletedAt: null,
        members: {
          some: {
            userId,
            status: MemberStatus.ACTIVE,
            deletedAt: null,
          },
        },
      },
      include: {
        members: { where: { deletedAt: null } },
      },
    });
  }

  async updateGroup(
    id: string,
    currentVersion: number,
    data: {
      name?: string;
      description?: string;
      defaultCurrency?: Currency;
      icon?: string;
      status?: GroupStatus;
      updatedBy?: string;
    }
  ) {
    const result = await this.prisma.splitGroup.updateMany({
      where: { id, version: currentVersion },
      data: {
        ...data,
        version: currentVersion + 1,
      },
    });

    if (result.count === 0) {
      throw new ConflictException('Optimistic concurrency lock failed: Group has been modified by another request.');
    }

    return this.prisma.splitGroup.findUnique({
      where: { id },
      include: { members: { where: { deletedAt: null } } },
    });
  }

  // ─── Members ───
  async addMember(
    groupId: string,
    data: {
      userId?: string;
      displayName: string;
      email?: string;
      phone?: string;
      createdBy?: string;
    }
  ) {
    return this.prisma.splitMember.create({
      data: {
        groupId,
        ...data,
        status: MemberStatus.ACTIVE,
        version: 1,
      },
    });
  }

  async findMemberById(id: string) {
    return this.prisma.splitMember.findUnique({
      where: { id, deletedAt: null },
      include: { group: true },
    });
  }

  async findMemberByUserId(groupId: string, userId: string) {
    return this.prisma.splitMember.findFirst({
      where: { groupId, userId, deletedAt: null },
    });
  }

  async listMembers(groupId: string) {
    return this.prisma.splitMember.findMany({
      where: { groupId, deletedAt: null },
    });
  }

  async updateMember(
    id: string,
    currentVersion: number,
    data: {
      displayName?: string;
      email?: string;
      phone?: string;
      status?: MemberStatus;
      leftAt?: Date;
      updatedBy?: string;
    }
  ) {
    const result = await this.prisma.splitMember.updateMany({
      where: { id, version: currentVersion },
      data: {
        ...data,
        version: currentVersion + 1,
      },
    });

    if (result.count === 0) {
      throw new ConflictException('Optimistic concurrency lock failed: Member has been modified by another request.');
    }

    return this.prisma.splitMember.findUnique({ where: { id } });
  }

  // ─── Expenses ───
  async createExpense(
    groupId: string,
    data: {
      createdBy: string;
      description: string;
      currency: Currency;
      totalAmount: Prisma.Decimal;
      expenseDate?: Date;
      categoryId?: string;
      notes?: string;
    },
    payers: { memberId: string; amountPaid: Prisma.Decimal }[],
    participants: { memberId: string; owedAmount: Prisma.Decimal; percentage?: Prisma.Decimal; shares?: Prisma.Decimal }[],
    splitType: SplitType
  ) {
    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.groupExpense.create({
        data: {
          groupId,
          createdBy: data.createdBy,
          description: data.description,
          currency: data.currency,
          totalAmount: data.totalAmount,
          expenseDate: data.expenseDate || new Date(),
          categoryId: data.categoryId,
          notes: data.notes,
          status: ExpenseStatus.ACTIVE,
          version: 1,
        },
      });

      // Payers
      await tx.expensePayer.createMany({
        data: payers.map(p => ({
          expenseId: expense.id,
          memberId: p.memberId,
          amountPaid: p.amountPaid,
        })),
      });

      // Participants
      await tx.expenseParticipant.createMany({
        data: participants.map(p => ({
          expenseId: expense.id,
          memberId: p.memberId,
          owedAmount: p.owedAmount,
          percentage: p.percentage,
          shares: p.shares,
        })),
      });

      // History log
      await tx.groupExpenseHistory.create({
        data: {
          expenseId: expense.id,
          version: 1,
          description: data.description,
          totalAmount: data.totalAmount,
          currency: data.currency,
          splitType,
          payers: payers.map(p => ({ memberId: p.memberId, amountPaid: p.amountPaid.toString() })) as any,
          participants: participants.map(p => ({
            memberId: p.memberId,
            owedAmount: p.owedAmount.toString(),
            percentage: p.percentage?.toString(),
            shares: p.shares?.toString(),
          })) as any,
          status: ExpenseStatus.ACTIVE,
          changedBy: data.createdBy,
        },
      });

      return tx.groupExpense.findUnique({
        where: { id: expense.id },
        include: {
          payers: true,
          participants: true,
        },
      });
    });
  }

  async findExpenseById(id: string) {
    return this.prisma.groupExpense.findUnique({
      where: { id, deletedAt: null },
      include: {
        payers: { include: { member: true } },
        participants: { include: { member: true } },
        history: { orderBy: { version: 'desc' } },
      },
    });
  }

  async listExpenses(groupId: string) {
    return this.prisma.groupExpense.findMany({
      where: { groupId, deletedAt: null },
      include: {
        payers: { include: { member: true } },
        participants: { include: { member: true } },
      },
      orderBy: { expenseDate: 'desc' },
    });
  }

  async updateExpense(
    id: string,
    currentVersion: number,
    data: {
      description?: string;
      totalAmount?: Prisma.Decimal;
      currency?: Currency;
      expenseDate?: Date;
      categoryId?: string;
      notes?: string;
      status?: ExpenseStatus;
      updatedBy: string;
    },
    payers?: { memberId: string; amountPaid: Prisma.Decimal }[],
    participants?: { memberId: string; owedAmount: Prisma.Decimal; percentage?: Prisma.Decimal; shares?: Prisma.Decimal }[],
    splitType?: SplitType
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Get current record
      const current = await tx.groupExpense.findUnique({
        where: { id },
        include: { payers: true, participants: true },
      });
      if (!current) throw new NotFoundException(`Expense ${id} not found`);

      const result = await tx.groupExpense.updateMany({
        where: { id, version: currentVersion },
        data: {
          ...data,
          splitType,
          version: currentVersion + 1,
        },
      });

      if (result.count === 0) {
        throw new ConflictException('Optimistic concurrency lock failed: Expense has been modified by another request.');
      }

      // Update payers if provided
      if (payers) {
        await tx.expensePayer.deleteMany({ where: { expenseId: id } });
        await tx.expensePayer.createMany({
          data: payers.map(p => ({
            expenseId: id,
            memberId: p.memberId,
            amountPaid: p.amountPaid,
          })),
        });
      }

      // Update participants if provided
      if (participants) {
        await tx.expenseParticipant.deleteMany({ where: { expenseId: id } });
        await tx.expenseParticipant.createMany({
          data: participants.map(p => ({
            expenseId: id,
            memberId: p.memberId,
            owedAmount: p.owedAmount,
            percentage: p.percentage,
            shares: p.shares,
          })),
        });
      }

      // Retrieve updated values
      const updatedExpense = await tx.groupExpense.findUnique({
        where: { id },
        include: { payers: true, participants: true },
      });

      const actualPayers = payers || current.payers;
      const actualParticipants = participants || current.participants;
      const actualSplitType = splitType || (current as any).splitType || SplitType.EQUAL;

      // History log
      await tx.groupExpenseHistory.create({
        data: {
          expenseId: id,
          version: currentVersion + 1,
          description: data.description || current.description,
          totalAmount: data.totalAmount || current.totalAmount,
          currency: data.currency || current.currency,
          splitType: actualSplitType,
          payers: actualPayers.map(p => ({ memberId: p.memberId, amountPaid: p.amountPaid.toString() })) as any,
          participants: actualParticipants.map(p => ({
            memberId: p.memberId,
            owedAmount: p.owedAmount.toString(),
            percentage: p.percentage?.toString(),
            shares: p.shares?.toString(),
          })) as any,
          status: data.status || current.status,
          changedBy: data.updatedBy,
        },
      });

      return updatedExpense;
    });
  }

  // ─── Settlements ───
  async createSettlement(data: {
    groupId: string;
    payerMemberId: string;
    receiverMemberId: string;
    amount: Prisma.Decimal;
    currency: Currency;
    notes?: string;
    idempotencyKey?: string;
    syncToFinance?: boolean;
    createdBy: string;
  }) {
    return this.prisma.settlement.create({
      data: {
        ...data,
        status: SettlementStatus.PENDING,
        version: 1,
      },
      include: {
        payerMember: true,
        receiverMember: true,
      },
    });
  }

  async findSettlementById(id: string) {
    return this.prisma.settlement.findUnique({
      where: { id },
      include: {
        payerMember: true,
        receiverMember: true,
      },
    });
  }

  async findSettlementByIdempotencyKey(key: string) {
    return this.prisma.settlement.findUnique({
      where: { idempotencyKey: key },
      include: {
        payerMember: true,
        receiverMember: true,
      },
    });
  }

  async listSettlements(groupId: string) {
    return this.prisma.settlement.findMany({
      where: { groupId },
      include: {
        payerMember: true,
        receiverMember: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateSettlement(
    id: string,
    currentVersion: number,
    data: {
      status?: SettlementStatus;
      settledAt?: Date;
      notes?: string;
    },
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || this.prisma;
    const result = await client.settlement.updateMany({
      where: { id, version: currentVersion },
      data: {
        ...data,
        version: currentVersion + 1,
      },
    });

    if (result.count === 0) {
      throw new ConflictException('Optimistic concurrency lock failed: Settlement has been modified by another request.');
    }

    return client.settlement.findUnique({
      where: { id },
      include: {
        payerMember: true,
        receiverMember: true,
      },
    });
  }
}
