import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { SplitterService } from '../services/splitter.service';
import { SplitterRepository } from '../repositories/splitter.repository';
import { SplitBalanceService } from '../services/split-balance.service';
import { DebtSimplificationService } from '../services/debt-simplification.service';
import { PrismaService } from '../../database/prisma.service';
import { IEventBus } from '../../telegram/interfaces/event-bus.interface';
import { ICommandRegistry } from '../../telegram/interfaces/command-registry.interface';
import { Currency, SplitType, MemberStatus, ExpenseStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';

process.env.NODE_ENV = 'test';
process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

async function runTests() {
  console.log('==================================================');
  console.log('🧪 Starting Enterprise Expense Splitter Integration Tests');
  console.log('==================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const splitterService = app.get(SplitterService);
  const balanceService = app.get(SplitBalanceService);
  const debtService = app.get(DebtSimplificationService);
  const eventBus = app.get(IEventBus);
  const commandRegistry = app.get(ICommandRegistry);

  // Setup Test Users in DB
  const userA = 'aaaaaa-1111-1111-1111-aaaaaaaaaaaa';
  const userB = 'bbbbbb-2222-2222-2222-bbbbbbbbbbbb';
  const userC = 'cccccc-3333-3333-3333-cccccccccccc';

  // Cleanup Database State
  const prismaAny = prisma as any;
  await prismaAny.settlement.deleteMany({});
  await prismaAny.expenseParticipant.deleteMany({});
  await prismaAny.expensePayer.deleteMany({});
  await prismaAny.groupExpenseHistory.deleteMany({});
  await prismaAny.groupExpense.deleteMany({});
  await prismaAny.splitMember.deleteMany({});
  await prismaAny.splitGroup.deleteMany({});
  await prismaAny.user.deleteMany({ where: { id: { in: [userA, userB, userC] } } });

  // Create clean users
  await prisma.user.create({
    data: { id: userA, telegramId: 11112222n, firstName: 'Alice', lastName: 'Owner', status: 'ACTIVE' },
  });
  await prisma.user.create({
    data: { id: userB, telegramId: 22223333n, firstName: 'Bob', lastName: 'Registered', status: 'ACTIVE' },
  });
  await prisma.user.create({
    data: { id: userC, telegramId: 33334444n, firstName: 'Charlie', lastName: 'Registered', status: 'ACTIVE' },
  });

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASSED: ${message}`);
      passed++;
    } else {
      console.log(`❌ FAILED: ${message}`);
      failed++;
    }
  }

  // Hook into EventBus to test event emission
  const emittedEvents: string[] = [];
  const originalPublish = eventBus.publish.bind(eventBus);
  eventBus.publish = async (eventName: string, payload: any) => {
    emittedEvents.push(eventName);
    return originalPublish(eventName, payload);
  };

  try {
    // 1. Group creation
    let group = await splitterService.createGroup(userA, {
      name: 'Trip to Paris',
      description: 'Shared holiday expenses',
      defaultCurrency: Currency.USD,
    });
    assert(group.name === 'Trip to Paris', '1. Create group with correct name');

    // 2. Owner automatically becomes member
    const ownerMember = group.members.find(m => m.userId === userA);
    assert(!!ownerMember && ownerMember.status === MemberStatus.ACTIVE, '2. Owner automatically joined as ACTIVE member');

    // 3. Registered member addition
    const bobMember = await splitterService.addMember(userA, group.id, {
      userId: userB,
      displayName: 'Bob R.',
    });
    assert(bobMember!.userId === userB && bobMember!.displayName === 'Bob R.', '3. Add registered member');

    // 4. External member addition
    const externalMember = await splitterService.addMember(userA, group.id, {
      displayName: 'Diana External',
      email: 'diana@external.com',
    });
    assert(externalMember!.userId === null && externalMember!.displayName === 'Diana External', '4. Add external member');

    // Re-fetch group to get updated members roster
    group = await splitterService.getGroup(userA, group.id);
    const memberAlice = group.members.find(m => m.userId === userA)!;
    const memberBob = group.members.find(m => m.userId === userB)!;
    const memberDiana = group.members.find(m => m.id === externalMember!.id)!;

    // 5. Equal split
    const expEqual = await splitterService.createExpense(userA, group.id, {
      description: 'Taxi Ride',
      currency: Currency.USD,
      totalAmount: '120.00',
      splitType: SplitType.EQUAL,
      payers: [{ memberId: memberAlice.id, amountPaid: '120.00' }],
      participants: [
        { memberId: memberAlice.id },
        { memberId: memberBob.id },
        { memberId: memberDiana.id },
      ],
    });
    assert(expEqual.participants.length === 3, '5. Split equally among 3 participants');
    assert(
      expEqual.participants.every(p => p.owedAmount.equals(new Prisma.Decimal('40.00'))),
      '5. Each owes exactly 40.00'
    );

    // 6. Equal split with indivisible decimal remainder
    const expRemainder = await splitterService.createExpense(userA, group.id, {
      description: 'Lunch sharing',
      currency: Currency.USD,
      totalAmount: '100.00',
      splitType: SplitType.EQUAL,
      payers: [{ memberId: memberAlice.id, amountPaid: '100.00' }],
      participants: [
        { memberId: memberAlice.id },
        { memberId: memberBob.id },
        { memberId: memberDiana.id },
      ],
    });
    // Deterministic remainder distribution: sorted by memberId.
    // Sum of owedAmounts must be exactly 100.00
    let sumOwed = new Prisma.Decimal(0);
    for (const p of expRemainder.participants) {
      sumOwed = sumOwed.add(p.owedAmount);
    }
    assert(sumOwed.equals(new Prisma.Decimal('100.00')), '6. Equal split sum is exactly 100.00');
    // Ensure one of them received 33.34 and others 33.33
    const values = expRemainder.participants.map(p => p.owedAmount.toNumber()).sort();
    assert(values[0] === 33.33 && values[1] === 33.33 && values[2] === 33.34, '6. Remainder distributed deterministically (+0.01 to one)');

    // 7. Exact split
    const expExact = await splitterService.createExpense(userA, group.id, {
      description: 'Museum tickets',
      currency: Currency.USD,
      totalAmount: '150.00',
      splitType: SplitType.EXACT,
      payers: [{ memberId: memberAlice.id, amountPaid: '150.00' }],
      participants: [
        { memberId: memberAlice.id, owedAmount: '50.00' },
        { memberId: memberBob.id, owedAmount: '100.00' },
      ],
    });
    assert(expExact.participants.length === 2, '7. Exact split created');

    // 8. Invalid exact split rejected
    try {
      await splitterService.createExpense(userA, group.id, {
        description: 'Wrong tickets',
        currency: Currency.USD,
        totalAmount: '150.00',
        splitType: SplitType.EXACT,
        payers: [{ memberId: memberAlice.id, amountPaid: '150.00' }],
        participants: [
          { memberId: memberAlice.id, owedAmount: '50.00' },
          { memberId: memberBob.id, owedAmount: '99.00' }, // Sums to 149
        ],
      });
      assert(false, 'Should have failed on exact split sum mismatch');
    } catch (err: any) {
      assert(err instanceof BadRequestException, '8. Invalid exact split rejected');
    }

    // 9. Percentage split
    const expPct = await splitterService.createExpense(userA, group.id, {
      description: 'Dinner',
      currency: Currency.USD,
      totalAmount: '200.00',
      splitType: SplitType.PERCENTAGE,
      payers: [{ memberId: memberAlice.id, amountPaid: '200.00' }],
      participants: [
        { memberId: memberAlice.id, percentage: '60.00' }, // 120
        { memberId: memberBob.id, percentage: '40.00' }, // 80
      ],
    });
    const aliceOwed = expPct.participants.find(p => p.memberId === memberAlice.id)!.owedAmount;
    assert(aliceOwed.equals(new Prisma.Decimal('120.00')), '9. Percentage split correct allocation');

    // 10. Percentage != 100 rejected
    try {
      await splitterService.createExpense(userA, group.id, {
        description: 'Wrong Dinner',
        currency: Currency.USD,
        totalAmount: '200.00',
        splitType: SplitType.PERCENTAGE,
        payers: [{ memberId: memberAlice.id, amountPaid: '200.00' }],
        participants: [
          { memberId: memberAlice.id, percentage: '50.00' },
          { memberId: memberBob.id, percentage: '40.00' },
        ],
      });
      assert(false, 'Should have failed on percentage mismatch');
    } catch (err: any) {
      assert(err instanceof BadRequestException, '10. Percentage != 100 rejected');
    }

    // 11. Share split
    const expShare = await splitterService.createExpense(userA, group.id, {
      description: 'Hotel Room',
      currency: Currency.USD,
      totalAmount: '300.00',
      splitType: SplitType.SHARES,
      payers: [{ memberId: memberAlice.id, amountPaid: '300.00' }],
      participants: [
        { memberId: memberAlice.id, shares: '2' }, // 2 shares
        { memberId: memberBob.id, shares: '1' }, // 1 share
      ],
    });
    const bobOwed = expShare.participants.find(p => p.memberId === memberBob.id)!.owedAmount;
    assert(bobOwed.equals(new Prisma.Decimal('100.00')), '11. Share split correctly allocated (100.00 for 1 share)');

    // 12. Multiple payers
    const expMultiPayer = await splitterService.createExpense(userA, group.id, {
      description: 'Drinks',
      currency: Currency.USD,
      totalAmount: '150.00',
      splitType: SplitType.EQUAL,
      payers: [
        { memberId: memberAlice.id, amountPaid: '100.00' },
        { memberId: memberBob.id, amountPaid: '50.00' },
      ],
      participants: [
        { memberId: memberAlice.id },
        { memberId: memberBob.id },
        { memberId: memberDiana.id },
      ],
    });
    assert(expMultiPayer.payers.length === 2, '12. Multiple payers processed successfully');

    // 13. Payer total mismatch rejected
    try {
      await splitterService.createExpense(userA, group.id, {
        description: 'Wrong Drink',
        currency: Currency.USD,
        totalAmount: '150.00',
        splitType: SplitType.EQUAL,
        payers: [
          { memberId: memberAlice.id, amountPaid: '100.00' },
          { memberId: memberBob.id, amountPaid: '40.00' }, // Sums to 140
        ],
        participants: [
          { memberId: memberAlice.id },
          { memberId: memberBob.id },
        ],
      });
      assert(false, 'Should fail on payers mismatch');
    } catch (err: any) {
      assert(err instanceof BadRequestException, '13. Payer total mismatch rejected');
    }

    // 14. Non-member payer rejected
    try {
      await splitterService.createExpense(userA, group.id, {
        description: 'Invalid Payer',
        currency: Currency.USD,
        totalAmount: '100.00',
        splitType: SplitType.EQUAL,
        payers: [{ memberId: '99999999-9999-9999-9999-999999999999', amountPaid: '100.00' }],
        participants: [{ memberId: memberAlice.id }],
      });
      assert(false, 'Should reject non-member payer');
    } catch (err: any) {
      assert(err instanceof BadRequestException, '14. Non-member payer rejected');
    }

    // 15. Non-member participant rejected
    try {
      await splitterService.createExpense(userA, group.id, {
        description: 'Invalid Participant',
        currency: Currency.USD,
        totalAmount: '100.00',
        splitType: SplitType.EQUAL,
        payers: [{ memberId: memberAlice.id, amountPaid: '100.00' }],
        participants: [{ memberId: '99999999-9999-9999-9999-999999999999' }],
      });
      assert(false, 'Should reject non-member participant');
    } catch (err: any) {
      assert(err instanceof BadRequestException, '15. Non-member participant rejected');
    }

    // 16. Balance calculation
    // Reset all expenses for simplicity of assertion on balances
    await prismaAny.settlement.deleteMany({});
    await prismaAny.expenseParticipant.deleteMany({});
    await prismaAny.expensePayer.deleteMany({});
    await prismaAny.groupExpenseHistory.deleteMany({});
    await prismaAny.groupExpense.deleteMany({});

    // Alice paid 300, Bob paid 0, Diana paid 0. Split equally (100 each)
    await splitterService.createExpense(userA, group.id, {
      description: 'Trip booking',
      currency: Currency.USD,
      totalAmount: '300.00',
      splitType: SplitType.EQUAL,
      payers: [{ memberId: memberAlice.id, amountPaid: '300.00' }],
      participants: [
        { memberId: memberAlice.id },
        { memberId: memberBob.id },
        { memberId: memberDiana.id },
      ],
    });

    const balances = await splitterService.getBalances(userA, group.id);
    const aliceBal = balances.find(b => b.memberId === memberAlice.id)!;
    const bobBal = balances.find(b => b.memberId === memberBob.id)!;
    const dianaBal = balances.find(b => b.memberId === memberDiana.id)!;

    assert(aliceBal.netBalance.equals(new Prisma.Decimal('200.00')), '16. Alice net balance is +200');
    assert(bobBal.netBalance.equals(new Prisma.Decimal('-100.00')), '16. Bob net balance is -100');
    assert(dianaBal.netBalance.equals(new Prisma.Decimal('-100.00')), '16. Diana net balance is -100');

    // 17. Net balance invariant == zero
    const sumNet = aliceBal.netBalance.add(bobBal.netBalance).add(dianaBal.netBalance);
    assert(sumNet.isZero(), '17. Net balance sum invariant equals zero');

    // 18. Debt simplification
    const debts = await splitterService.getSimplifiedDebts(userA, group.id);
    assert(debts.length === 2, '18. Debt graph simplified to 2 debts');
    const bobOwesAlice = debts.some(d => d.fromMemberId === memberBob.id && d.toMemberId === memberAlice.id && d.amount.equals(new Prisma.Decimal('100.00')));
    const dianaOwesAlice = debts.some(d => d.fromMemberId === memberDiana.id && d.toMemberId === memberAlice.id && d.amount.equals(new Prisma.Decimal('100.00')));
    assert(bobOwesAlice && dianaOwesAlice, '18. Debt graph matches expected simplified matching');

    // 19. Partial settlement
    let settlement = await splitterService.createSettlement(userB, group.id, {
      payerMemberId: memberBob.id,
      receiverMemberId: memberAlice.id,
      amount: '40.00',
      currency: Currency.USD,
      idempotencyKey: 'idemp-key-1',
    });
    // Complete it
    await splitterService.completeSettlement(userA, group.id, settlement.id, settlement.version);
    const balancesAfterPartial = await splitterService.getBalances(userA, group.id);
    const bobBalPartial = balancesAfterPartial.find(b => b.memberId === memberBob.id)!;
    assert(bobBalPartial.netBalance.equals(new Prisma.Decimal('-60.00')), '19. Partial settlement updated Bob net balance correctly to -60.00');

    // 20. Full settlement
    settlement = await splitterService.createSettlement(userB, group.id, {
      payerMemberId: memberBob.id,
      receiverMemberId: memberAlice.id,
      amount: '60.00',
      currency: Currency.USD,
      idempotencyKey: 'idemp-key-2',
    });
    await splitterService.completeSettlement(userA, group.id, settlement.id, settlement.version);
    const balancesAfterFull = await splitterService.getBalances(userA, group.id);
    const bobBalFull = balancesAfterFull.find(b => b.memberId === memberBob.id)!;
    assert(bobBalFull.netBalance.isZero(), '20. Full settlement cleared Bob debt to 0.00');

    // 21. Duplicate/idempotent settlement protection
    const dupSettlement = await splitterService.createSettlement(userB, group.id, {
      payerMemberId: memberBob.id,
      receiverMemberId: memberAlice.id,
      amount: '60.00',
      currency: Currency.USD,
      idempotencyKey: 'idemp-key-2', // same key
    });
    assert(dupSettlement.id === settlement.id, '21. Duplicate settlement request returned previous settlement (idempotent)');

    // 22. Expense voiding
    const beforeVoidBalances = await splitterService.getBalances(userA, group.id);
    const dianaBefore = beforeVoidBalances.find(b => b.memberId === memberDiana.id)!.netBalance;
    
    // Void the first expense
    const firstExp = (await splitterService.listExpenses(userA, group.id))[0];
    await splitterService.voidExpense(userA, group.id, firstExp.id);
    
    const afterVoidBalances = await splitterService.getBalances(userA, group.id);
    const dianaAfter = afterVoidBalances.find(b => b.memberId === memberDiana.id)!.netBalance;
    assert(dianaBefore.equals(new Prisma.Decimal('-100.00')) && dianaAfter.isZero(), '22. Expense voiding recalculated net balance back to zero');

    // 23. OCC stale update returns 409
    const testExp = await splitterService.createExpense(userA, group.id, {
      description: 'Occ Test',
      currency: Currency.USD,
      totalAmount: '90.00',
      splitType: SplitType.EQUAL,
      payers: [{ memberId: memberAlice.id, amountPaid: '90.00' }],
      participants: [{ memberId: memberAlice.id }],
    });
    // Try updating with stale version
    try {
      await splitterService.updateExpense(userA, group.id, testExp.id, 0, {
        description: 'Stale update',
      });
      assert(false, 'Should have failed on OCC stale version');
    } catch (err: any) {
      assert(err instanceof ConflictException, '23. OCC stale update throws ConflictException (409)');
    }

    // 24. Events emitted
    assert(emittedEvents.includes('SplitGroupCreated'), '24. Emitted SplitGroupCreated');
    assert(emittedEvents.includes('GroupExpenseCreated'), '24. Emitted GroupExpenseCreated');
    assert(emittedEvents.includes('SettlementCompleted'), '24. Emitted SettlementCompleted');

    // 25. Telegram command registration
    const groupsCmd = commandRegistry.get('groups');
    const splitCmd = commandRegistry.get('split');
    assert(!!groupsCmd && !!splitCmd, '25. Telegram commands (/groups, /split) successfully registered');

    // 26. Unauthorized group access rejected
    // User C is not in this group
    try {
      await splitterService.getGroup(userC, group.id);
      assert(false, 'Should block unauthorized access');
    } catch (err: any) {
      assert(err instanceof ForbiddenException, '26. Unauthorized access throws ForbiddenException');
    }

    // 27. Decimal precision preserved
    const preciseExp = await splitterService.createExpense(userA, group.id, {
      description: 'Coffee',
      currency: Currency.USD,
      totalAmount: '10.5678', // 4 decimal places
      splitType: SplitType.EQUAL,
      payers: [{ memberId: memberAlice.id, amountPaid: '10.5678' }],
      participants: [{ memberId: memberAlice.id }],
    });
    assert(preciseExp.totalAmount.equals(new Prisma.Decimal('10.5678')), '27. Decimal precision preserved (10.5678)');

    // 28. Historical expenses remain intact after member removal
    const beforeRemove = await splitterService.getBalances(userA, group.id);
    const dianaBalBefore = beforeRemove.find(b => b.memberId === memberDiana.id)!.netBalance;
    assert(dianaBalBefore.isZero(), 'Diana is settled.');
    
    // Remove Diana
    await splitterService.removeMember(userA, group.id, memberDiana.id);
    const removedMember = await prisma.splitMember.findUnique({ where: { id: memberDiana.id } });
    assert(removedMember?.status === MemberStatus.REMOVED, 'Member status changed to REMOVED');
    
    // Verify historical records still have Diana
    const historicalExpenses = await splitterService.listExpenses(userA, group.id);
    const hasDiana = historicalExpenses.some(e => e.participants.some(p => p.memberId === memberDiana.id));
    assert(hasDiana, '28. Historical expenses remain intact after member removal');

  } catch (err: any) {
    console.error('Error during test execution:', err);
    failed++;
  } finally {
    // Teardown
    console.log('\n==================================================');
    console.log(`🧪 Test Run Completed. Passed: ${passed}, Failed: ${failed}`);
    console.log('==================================================');
    await app.close();
  }
}

runTests();
