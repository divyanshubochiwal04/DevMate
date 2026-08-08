import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { FinanceService } from '../services/finance.service';
import { FinanceRepository } from '../repositories/finance.repository';
import { PrismaService } from '../../database/prisma.service';
import { IEventBus } from '../../telegram/interfaces/event-bus.interface';
import { TelegramBotProvider } from '../../telegram/bot/telegram-bot.provider';
import { Prisma, AccountType, TransactionType, TransactionStatus, Currency, BudgetPeriod, LoanStatus, LoanDirection, EMIStatus } from '@prisma/client';

process.env.NODE_ENV = 'test';
process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

async function runTests() {
  console.log('==================================================');
  console.log('🧪 Starting Enterprise Finance Engine Integration Tests');
  console.log('==================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const financeService = app.get(FinanceService);
  const financeRepository = app.get(FinanceRepository);
  const botProvider = app.get(TelegramBotProvider);
  const eventBus = app.get(IEventBus);

  // Setup Test User in DB
  const testUserUuid = '99999999-4444-4444-4444-999999999999';

  // Cleanup Database state
  const prismaAny = prisma as any;
  await prismaAny.ledgerEntry.deleteMany({ where: { user: { id: testUserUuid } } });
  await prismaAny.loanEMI.deleteMany({ where: { loan: { userId: testUserUuid } } });
  await prismaAny.loan.deleteMany({ where: { userId: testUserUuid } });
  await prismaAny.subscription.deleteMany({ where: { userId: testUserUuid } });
  await prismaAny.recurringTransaction.deleteMany({ where: { userId: testUserUuid } });
  await prismaAny.transaction.deleteMany({ where: { userId: testUserUuid } });
  await prismaAny.budget.deleteMany({ where: { userId: testUserUuid } });
  await prismaAny.expenseCategory.deleteMany({ where: { userId: testUserUuid } });
  await prismaAny.account.deleteMany({ where: { userId: testUserUuid } });
  await prismaAny.user.deleteMany({ where: { id: testUserUuid } });

  // Also clean up any leftover user with the same telegramId to prevent unique constraint violation
  await prismaAny.user.deleteMany({ where: { telegramId: 99992222n, id: { not: testUserUuid } } });

  // Create clean user
  await prisma.user.create({
    data: {
      id: testUserUuid,
      telegramId: 99992222n,
      firstName: 'Charlie',
      lastName: 'FinanceTester',
      username: 'charliefin',
      status: 'ACTIVE',
    },
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

  try {
    // ──────── Test 1: Accounts Creation & Money Precision ────────
    const bankAccount = await financeService.createAccount(testUserUuid, {
      name: 'Chase Checking',
      type: AccountType.BANK,
      currency: Currency.USD,
      openingBalance: '1000.5000',
      allowNegativeBalance: false,
    });

    assert(bankAccount.name === 'Chase Checking', 'Should create account with correct name');
    assert(bankAccount.openingBalance.amount.equals(new Prisma.Decimal('1000.5000')), 'Opening balance should retain decimal precision');
    assert(bankAccount.currentBalance.amount.equals(new Prisma.Decimal('1000.5000')), 'Current balance equals opening balance initially');

    // ──────── Test 2: Overdraft Rejection (allowNegativeBalance = false) ────────
    try {
      await financeService.createTransaction(testUserUuid, {
        type: TransactionType.EXPENSE,
        accountId: bankAccount.id,
        amount: '-1500.0000', // exceeds 1000.5000 balance
        currency: Currency.USD,
        description: 'Buying a laptop',
      });
      assert(false, 'Should throw BadRequestException on overdraft');
    } catch (err: any) {
      assert(err.message.includes('Insufficient funds'), 'Overdrafts must be blocked when allowNegativeBalance is disabled');
    }

    // ──────── Test 3: Transfers (Double Linked Transactions) ────────
    const walletAccount = await financeService.createAccount(testUserUuid, {
      name: 'Physical Wallet',
      type: AccountType.WALLET,
      currency: Currency.USD,
      openingBalance: '50.0000',
      allowNegativeBalance: true,
    });

    const transferTx = await financeService.createTransaction(testUserUuid, {
      type: TransactionType.TRANSFER,
      accountId: bankAccount.id, // source
      toAccountId: walletAccount.id, // dest
      amount: '200.0000',
      currency: Currency.USD,
      description: 'Atm withdrawal',
    });

    assert(transferTx.transferId !== null, 'Transfer transactions must generate a shared transferId');

    // Verify source account is debited, dest account is credited
    const updatedBank = await financeService.getAccountById(bankAccount.id);
    const updatedWallet = await financeService.getAccountById(walletAccount.id);

    assert(updatedBank.currentBalance.amount.equals(new Prisma.Decimal('800.5000')), 'Source account must be debited by transfer amount');
    assert(updatedWallet.currentBalance.amount.equals(new Prisma.Decimal('250.0000')), 'Destination account must be credited by transfer amount');

    // Assert both transaction entries are created in database
    const allTxs = await prisma.transaction.findMany({
      where: { transferId: transferTx.transferId! },
    });
    assert(allTxs.length === 2, 'Transfer must insert exactly two linked transaction rows');
    
    // ──────── Test 4: Reject Same-Account Transfers ────────
    try {
      await financeService.createTransaction(testUserUuid, {
        type: TransactionType.TRANSFER,
        accountId: bankAccount.id,
        toAccountId: bankAccount.id,
        amount: '10.0000',
        currency: Currency.USD,
        description: 'Self transfer',
      });
      assert(false, 'Same account transfer should be rejected');
    } catch (err: any) {
      assert(err.message.includes('must be different'), 'Transfers to the same account must be rejected');
    }

    // ──────── Test 5: Budgets & Progress (BudgetExceeded Event) ────────
    const category = await financeService.createCategory(testUserUuid, { name: 'Food' });
    const budget = await financeService.createBudget(testUserUuid, {
      amount: '100.0000',
      currency: Currency.USD,
      period: BudgetPeriod.MONTHLY,
      startDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      endDate: new Date(Date.now() + 86400000 * 10).toISOString(), // 10 days out
      categoryId: category.id,
    });

    let budgetExceededFired = false;
    eventBus.subscribe('BudgetExceeded', async () => {
      budgetExceededFired = true;
    });

    // Exceeding expense: $120.00
    await financeService.createTransaction(testUserUuid, {
      type: TransactionType.EXPENSE,
      accountId: bankAccount.id,
      categoryId: category.id,
      amount: '-120.0000',
      currency: Currency.USD,
      description: 'Fancy Dinner',
    });

    assert(budgetExceededFired, 'Budget spent limit exceeding should fire BudgetExceeded event');

    // ──────── Test 6: Loan & EMI Amortization ────────
    const loan = await financeService.createLoan(testUserUuid, {
      principal: '1200.0000',
      currency: Currency.USD,
      interestRate: '5.00',
      durationMonths: 12,
      startDate: new Date().toISOString(),
      direction: LoanDirection.BORROWED,
    });

    assert(loan.principalMoney.amount.equals(new Prisma.Decimal('1200.0000')), 'Loan principal must match principal input');
    
    // Check auto-generation of 12 EMIs: 1200 / 12 = 100 per month
    const loanDetails = await prisma.loan.findUnique({
      where: { id: loan.id },
      include: { emis: true },
    });
    assert(loanDetails!.emis.length === 12, 'Loan creation must auto-generate correct count of LoanEMI records');
    assert(loanDetails!.emis[0].amount.equals(new Prisma.Decimal('100.0000')), 'EMI amount must match principal divided by duration');

    // Pay EMI: reduces remaining loan balance
    const targetEmi = loanDetails!.emis.find(e => e.installmentNumber === 1);
    const paidEmi = await financeService.payEMI(targetEmi!.id, '5.0000'); // $5 late fee
    assert(paidEmi.status === EMIStatus.PAID, 'Paying EMI must transition status to PAID');
    assert(paidEmi.lateFeeMoney.amount.equals(new Prisma.Decimal('5.0000')), 'Paid EMI must track late fees');

    const freshLoan = await financeService.listLoans(testUserUuid);
    assert(freshLoan[0].remainingBalanceMoney.amount.equals(new Prisma.Decimal('1100.0000')), 'Paying EMI must decrement loan remaining balance by paid EMI principal');

    // ──────── Test 7: Telegram Commands Integration ────────
    // Bot pipeline integration: /expense command must persist a transaction in the DB.
    // We verify the observable side-effect (DB write) rather than intercepting the
    // Telegraf reply, which requires mocking private Telegraf internals.
    const bot = botProvider.getBotInstance();
    bot.botInfo = { id: 111222, is_bot: true, first_name: 'TestBot', username: 'test_bot', can_join_groups: true, can_read_all_group_messages: true, supports_inline_queries: true };

    // Count transactions before the bot command
    const txCountBefore = await prisma.transaction.count({ where: { userId: testUserUuid } });

    // Override handleUpdate directly on the instance to inject a silent tg.
    // handleUpdate() internally creates `new Telegram(token)` per-update which would hit
    // the real API with a fake token. The instance override short-circuits that.
    const originalHandleUpdate = bot.handleUpdate.bind(bot);
    (bot as any).handleUpdate = async function (update: any) {
      const silentTg = new Proxy((bot as any).telegram, {
        get(target: any, prop: string) {
          if (prop === 'callApi') {
            return async () => ({ message_id: 1, chat: { id: 0 }, date: Date.now() });
          }
          const val = target[prop];
          return typeof val === 'function' ? val.bind(target) : val;
        },
      });

      const TelegrafContext = (bot as any).options.contextType;
      const ctx = new TelegrafContext(update, silentTg, bot.botInfo);
      Object.assign(ctx, (bot as any).context);
      try {
        await (bot as any).middleware()(ctx, async () => {});
      } catch (_) {
        // suppress reply errors in test
      }
    };

    await (bot as any).handleUpdate({
      update_id: 301,
      message: {
        message_id: 301,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 111, type: 'private', first_name: 'Charlie' } as any,
        from: { id: 99992222, is_bot: false, first_name: 'Charlie', username: 'charliefin' },
        text: '/expense 15.50 Taxi ride',
      },
    });

    const txCountAfter = await prisma.transaction.count({ where: { userId: testUserUuid } });
    const latestTx = await prisma.transaction.findFirst({
      where: { userId: testUserUuid },
      orderBy: { createdAt: 'desc' },
    });

    assert(txCountAfter > txCountBefore, 'Telegram /expense command should run and log transaction');
    assert(latestTx !== null && latestTx.description === 'Taxi ride', 'Telegram /expense command should store correct description');
    assert(latestTx !== null && latestTx.amount.abs().equals(new Prisma.Decimal('15.5000')), 'Telegram /expense command should store correct amount');

    (bot as any).handleUpdate = originalHandleUpdate;

  } catch (error) {
    console.error('❌ Test execution encountered an unhandled error:', error);
    failed++;
  } finally {
    // Cleanup Database test entries
    await prismaAny.ledgerEntry.deleteMany({ where: { user: { id: testUserUuid } } });
    await prismaAny.loanEMI.deleteMany({ where: { loan: { userId: testUserUuid } } });
    await prismaAny.loan.deleteMany({ where: { userId: testUserUuid } });
    await prismaAny.subscription.deleteMany({ where: { userId: testUserUuid } });
    await prismaAny.recurringTransaction.deleteMany({ where: { userId: testUserUuid } });
    await prismaAny.transaction.deleteMany({ where: { userId: testUserUuid } });
    await prismaAny.budget.deleteMany({ where: { userId: testUserUuid } });
    await prismaAny.expenseCategory.deleteMany({ where: { userId: testUserUuid } });
    await prismaAny.account.deleteMany({ where: { userId: testUserUuid } });
    await prismaAny.user.deleteMany({ where: { id: testUserUuid } });

    await app.close();
  }

  console.log('\n==================================================');
  console.log(`🏁 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
