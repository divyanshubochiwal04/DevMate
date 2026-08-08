import { Injectable } from '@nestjs/common';
import { TelegramCommand } from '../../telegram/commands/decorators/telegram-command.decorator';
import { TelegramCommandHandler } from '../../telegram/interfaces/command-handler.interface';
import { TelegramContext } from '../../telegram/interfaces/telegram-context.interface';
import { FinanceService } from '../services/finance.service';
import { MessageBuilder } from '../../telegram/builders/message.builder';
import { TransactionType, Currency, AccountType } from '@prisma/client';

@Injectable()
@TelegramCommand({
  command: 'expense',
  aliases: ['spend'],
  category: 'finance',
  cooldown: 2,
  description: 'Log an expense: /expense <amount> <description>',
})
export class ExpenseCommandHandler implements TelegramCommandHandler {
  constructor(private readonly financeService: FinanceService) {}

  async handle(ctx: TelegramContext) {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const args = text.replace(/^\/(expense|spend)\s*/i, '').trim();

    const match = args.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
    if (!match) {
      await ctx.reply('⚠️ Please provide an amount and description, e.g.\n`/expense 12.50 Lunch`', { parse_mode: 'MarkdownV2' });
      return;
    }

    if (!ctx.user) {
      await ctx.reply('❌ Authentication failed. User context not resolved.');
      return;
    }

    const amountStr = match[1];
    const description = match[2].trim();

    // Resolve or auto-create a default CASH account
    const accounts = await this.financeService.listAccounts(ctx.user.id);
    let account = accounts[0];
    if (!account) {
      account = await this.financeService.createAccount(ctx.user.id, {
        name: 'Main Cash',
        type: AccountType.CASH,
        currency: Currency.USD,
        openingBalance: '0.0000',
        allowNegativeBalance: true,
      });
    }

    const tx = await this.financeService.createTransaction(ctx.user.id, {
      type: TransactionType.EXPENSE,
      amount: `-${amountStr}`, // negative for outflow
      currency: account.openingBalance.currency,
      description,
      accountId: account.id,
    });

    await ctx.reply(`✅ Expense logged successfully\\!\n\n*Amount:* \`${MessageBuilder.escapeMarkdownV2(tx.money.toString())}\`\n*Account:* ${MessageBuilder.escapeMarkdownV2(account.name)}\n*Desc:* ${MessageBuilder.escapeMarkdownV2(tx.description)}`, {
      parse_mode: 'MarkdownV2',
    });
  }
}

@Injectable()
@TelegramCommand({
  command: 'income',
  category: 'finance',
  cooldown: 2,
  description: 'Log an income: /income <amount> <description>',
})
export class IncomeCommandHandler implements TelegramCommandHandler {
  constructor(private readonly financeService: FinanceService) {}

  async handle(ctx: TelegramContext) {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const args = text.replace(/^\/income\s*/i, '').trim();

    const match = args.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
    if (!match) {
      await ctx.reply('⚠️ Please provide an amount and description, e.g.\n`/income 1500 Salary`', { parse_mode: 'MarkdownV2' });
      return;
    }

    if (!ctx.user) {
      await ctx.reply('❌ Authentication failed.');
      return;
    }

    const amountStr = match[1];
    const description = match[2].trim();

    const accounts = await this.financeService.listAccounts(ctx.user.id);
    let account = accounts[0];
    if (!account) {
      account = await this.financeService.createAccount(ctx.user.id, {
        name: 'Main Cash',
        type: AccountType.CASH,
        currency: Currency.USD,
        openingBalance: '0.0000',
        allowNegativeBalance: true,
      });
    }

    const tx = await this.financeService.createTransaction(ctx.user.id, {
      type: TransactionType.INCOME,
      amount: amountStr, // positive for inflow
      currency: account.openingBalance.currency,
      description,
      accountId: account.id,
    });

    await ctx.reply(`✅ Income logged successfully\\!\n\n*Amount:* \`${MessageBuilder.escapeMarkdownV2(tx.money.toString())}\`\n*Account:* ${MessageBuilder.escapeMarkdownV2(account.name)}\n*Desc:* ${MessageBuilder.escapeMarkdownV2(tx.description)}`, {
      parse_mode: 'MarkdownV2',
    });
  }
}

@Injectable()
@TelegramCommand({
  command: 'balance',
  category: 'finance',
  cooldown: 3,
  description: 'Check account balances: /balance',
})
export class BalanceCommandHandler implements TelegramCommandHandler {
  constructor(private readonly financeService: FinanceService) {}

  async handle(ctx: TelegramContext) {
    if (!ctx.user) {
      await ctx.reply('❌ Authentication failed.');
      return;
    }

    const accounts = await this.financeService.listAccounts(ctx.user.id);
    if (accounts.length === 0) {
      await ctx.reply('💰 You have no accounts set up! Use the /expense or /income commands to auto-create a cash wallet.');
      return;
    }

    let response = '💰 *Your Account Balances:*\n\n';
    accounts.forEach((acc) => {
      response += `*${MessageBuilder.escapeMarkdownV2(acc.name)}* \\(${acc.type}\\):\n   \`${MessageBuilder.escapeMarkdownV2(acc.availableBalance.toString())}\`\n\n`;
    });

    await ctx.reply(response, { parse_mode: 'MarkdownV2' });
  }
}

@Injectable()
@TelegramCommand({
  command: 'budget',
  category: 'finance',
  cooldown: 3,
  description: 'Check budget limits: /budget',
})
export class BudgetCommandHandler implements TelegramCommandHandler {
  constructor(private readonly financeService: FinanceService) {}

  async handle(ctx: TelegramContext) {
    if (!ctx.user) {
      await ctx.reply('❌ Authentication failed.');
      return;
    }

    const budgets = await this.financeService.listBudgets(ctx.user.id);
    if (budgets.length === 0) {
      await ctx.reply('📊 You have no active budgets set up!');
      return;
    }

    let response = '📊 *Your Budget Progress:*\n\n';
    budgets.forEach((b) => {
      response += `*Category Budget:* \`${MessageBuilder.escapeMarkdownV2(b.allocatedMoney.toString())}\`\n`;
      response += `   Spent: \`${MessageBuilder.escapeMarkdownV2(b.spentMoney.toString())}\`\n`;
      response += `   Progress: *${b.progress}%*\n\n`;
    });

    await ctx.reply(response, { parse_mode: 'MarkdownV2' });
  }
}

@Injectable()
@TelegramCommand({
  command: 'loan',
  category: 'finance',
  cooldown: 3,
  description: 'Check loans: /loan',
})
export class LoanCommandHandler implements TelegramCommandHandler {
  constructor(private readonly financeService: FinanceService) {}

  async handle(ctx: TelegramContext) {
    if (!ctx.user) {
      await ctx.reply('❌ Authentication failed.');
      return;
    }

    const loans = await this.financeService.listLoans(ctx.user.id);
    if (loans.length === 0) {
      await ctx.reply('🏦 You have no active loans!');
      return;
    }

    let response = '🏦 *Your Loans:*\n\n';
    loans.forEach((l) => {
      response += `*Loan:* \`${MessageBuilder.escapeMarkdownV2(l.principalMoney.toString())}\` \\(${l.direction}\\)\n`;
      response += `   Remaining: \`${MessageBuilder.escapeMarkdownV2(l.remainingBalanceMoney.toString())}\`\n`;
      response += `   Status: \`${l.status}\`\n\n`;
    });

    await ctx.reply(response, { parse_mode: 'MarkdownV2' });
  }
}
