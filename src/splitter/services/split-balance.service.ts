import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SplitterRepository } from '../repositories/splitter.repository';

export interface MemberBalance {
  memberId: string;
  displayName: string;
  userId: string | null;
  totalPaid: Prisma.Decimal;
  totalOwed: Prisma.Decimal;
  totalSettledPaid: Prisma.Decimal;
  totalSettledReceived: Prisma.Decimal;
  netBalance: Prisma.Decimal;
}

@Injectable()
export class SplitBalanceService {
  constructor(private readonly repository: SplitterRepository) {}

  async calculateBalances(groupId: string): Promise<MemberBalance[]> {
    const members = await this.repository.listMembers(groupId);
    const expenses = await this.repository.listExpenses(groupId);
    const settlements = await this.repository.listSettlements(groupId);

    // Initialize balance map
    const balanceMap = new Map<string, MemberBalance>();
    for (const member of members) {
      balanceMap.set(member.id, {
        memberId: member.id,
        displayName: member.displayName,
        userId: member.userId,
        totalPaid: new Prisma.Decimal(0),
        totalOwed: new Prisma.Decimal(0),
        totalSettledPaid: new Prisma.Decimal(0),
        totalSettledReceived: new Prisma.Decimal(0),
        netBalance: new Prisma.Decimal(0),
      });
    }

    // Process active expenses
    for (const expense of expenses) {
      if (expense.status === 'VOIDED') continue;

      for (const payer of expense.payers) {
        const bal = balanceMap.get(payer.memberId);
        if (bal) {
          bal.totalPaid = bal.totalPaid.add(payer.amountPaid);
        }
      }

      for (const participant of expense.participants) {
        const bal = balanceMap.get(participant.memberId);
        if (bal) {
          bal.totalOwed = bal.totalOwed.add(participant.owedAmount);
        }
      }
    }

    // Process completed settlements
    for (const settlement of settlements) {
      if (settlement.status !== 'COMPLETED') continue;

      const debtorBal = balanceMap.get(settlement.payerMemberId);
      if (debtorBal) {
        debtorBal.totalSettledPaid = debtorBal.totalSettledPaid.add(settlement.amount);
      }

      const creditorBal = balanceMap.get(settlement.receiverMemberId);
      if (creditorBal) {
        creditorBal.totalSettledReceived = creditorBal.totalSettledReceived.add(settlement.amount);
      }
    }

    // Compute net balance and verify invariant
    let sumOfNetBalances = new Prisma.Decimal(0);
    const results: MemberBalance[] = [];

    for (const bal of balanceMap.values()) {
      bal.netBalance = bal.totalPaid
        .sub(bal.totalOwed)
        .add(bal.totalSettledPaid)
        .sub(bal.totalSettledReceived);

      sumOfNetBalances = sumOfNetBalances.add(bal.netBalance);
      results.push(bal);
    }

    // Invariant validation: sum of net balances must be zero
    if (!sumOfNetBalances.isZero()) {
      const precisionError = sumOfNetBalances.abs();
      // If there's a minor precision error, let's log it, but since we use exact decimal math it should be exactly 0.
      if (precisionError.greaterThan('0.0001')) {
        console.warn(`[BalanceEngine] Warning: Invariant check failed. SUM(netBalances) = ${sumOfNetBalances.toString()}`);
      }
    }

    return results;
  }
}
