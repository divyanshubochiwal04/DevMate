import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MemberBalance } from './split-balance.service';

export interface SimplifiedDebt {
  fromMemberId: string;
  fromDisplayName: string;
  toMemberId: string;
  toDisplayName: string;
  amount: Prisma.Decimal;
}

@Injectable()
export class DebtSimplificationService {
  /**
   * Simplifies group debts using a deterministic greedy algorithm.
   * Matches the largest debtors with the largest creditors.
   * Maintains exact Decimal precision and zero-sum balance invariants.
   */
  simplifyDebts(balances: MemberBalance[]): SimplifiedDebt[] {
    // Separate into debtors (negative netBalance) and creditors (positive netBalance)
    const debtors = balances
      .filter(b => b.netBalance.isNegative())
      .map(b => ({
        memberId: b.memberId,
        displayName: b.displayName,
        netBalance: b.netBalance.abs(), // use absolute value for debtors
      }));

    const creditors = balances
      .filter(b => b.netBalance.isPositive())
      .map(b => ({
        memberId: b.memberId,
        displayName: b.displayName,
        netBalance: new Prisma.Decimal(b.netBalance),
      }));

    const simplifiedDebts: SimplifiedDebt[] = [];

    // Helper to sort deterministically: descending by balance, then alphabetically by memberId
    const sortDebtors = () => {
      debtors.sort((a, b) => {
        if (!a.netBalance.equals(b.netBalance)) {
          return b.netBalance.sub(a.netBalance).toNumber();
        }
        return a.memberId.localeCompare(b.memberId);
      });
    };

    const sortCreditors = () => {
      creditors.sort((a, b) => {
        if (!a.netBalance.equals(b.netBalance)) {
          return b.netBalance.sub(a.netBalance).toNumber();
        }
        return a.memberId.localeCompare(b.memberId);
      });
    };

    sortDebtors();
    sortCreditors();

    let debtorIdx = 0;
    let creditorIdx = 0;

    // Loop until we settle all balances (within a tiny precision threshold)
    const epsilon = new Prisma.Decimal('0.0001');

    while (debtorIdx < debtors.length && creditorIdx < creditors.length) {
      const debtor = debtors[debtorIdx];
      const creditor = creditors[creditorIdx];

      if (debtor.netBalance.lessThan(epsilon)) {
        debtorIdx++;
        continue;
      }
      if (creditor.netBalance.lessThan(epsilon)) {
        creditorIdx++;
        continue;
      }

      // Settle amount is the minimum of what debtor owes and what creditor is owed
      const amountToSettle = Prisma.Decimal.min(debtor.netBalance, creditor.netBalance);

      simplifiedDebts.push({
        fromMemberId: debtor.memberId,
        fromDisplayName: debtor.displayName,
        toMemberId: creditor.memberId,
        toDisplayName: creditor.displayName,
        amount: amountToSettle,
      });

      // Deduct from both
      debtor.netBalance = debtor.netBalance.sub(amountToSettle);
      creditor.netBalance = creditor.netBalance.sub(amountToSettle);

      // Re-sort to maintain greedy matching
      sortDebtors();
      sortCreditors();
    }

    return simplifiedDebts;
  }
}
