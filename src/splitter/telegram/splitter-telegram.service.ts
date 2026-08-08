import { Injectable } from '@nestjs/common';
import { TelegramCommand } from '../../telegram/commands/decorators/telegram-command.decorator';
import { TelegramCommandHandler } from '../../telegram/interfaces/command-handler.interface';
import { TelegramContext } from '../../telegram/interfaces/telegram-context.interface';
import { SplitterService } from '../services/splitter.service';
import { MessageBuilder } from '../../telegram/builders/message.builder';
import { Currency } from '@prisma/client';

@Injectable()
@TelegramCommand({
  command: 'groups',
  category: 'splitter',
  cooldown: 2,
  description: 'List your expense sharing groups: /groups',
})
export class GroupsCommandHandler implements TelegramCommandHandler {
  constructor(private readonly splitterService: SplitterService) {}

  async handle(ctx: TelegramContext) {
    if (!ctx.user) {
      await ctx.reply('❌ Authentication failed. User context not resolved.');
      return;
    }

    const groups = await this.splitterService.listGroups(ctx.user.id);
    if (groups.length === 0) {
      await ctx.reply('ℹ️ You do not belong to any expense splitter groups. Create one in the app first!');
      return;
    }

    let text = '*Your Expense Splitter Groups:*\n\n';
    for (const g of groups) {
      const escapedName = MessageBuilder.escapeMarkdownV2(g.name);
      const escapedCurr = MessageBuilder.escapeMarkdownV2(g.defaultCurrency);
      text += `• *${escapedName}* \\(${escapedCurr}\\) \\- ${g.members.length} members\n`;
    }

    await ctx.reply(text, { parse_mode: 'MarkdownV2' });
  }
}

@Injectable()
@TelegramCommand({
  command: 'group',
  category: 'splitter',
  cooldown: 2,
  description: 'View group details: /group <group_name>',
})
export class GroupCommandHandler implements TelegramCommandHandler {
  constructor(private readonly splitterService: SplitterService) {}

  async handle(ctx: TelegramContext) {
    if (!ctx.user) {
      await ctx.reply('❌ Authentication failed.');
      return;
    }

    const msgText = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const groupName = msgText.replace(/^\/group\s*/i, '').trim();

    if (!groupName) {
      await ctx.reply('⚠️ Please provide a group name, e.g. `/group Trip`', { parse_mode: 'MarkdownV2' });
      return;
    }

    const groups = await this.splitterService.listGroups(ctx.user.id);
    const group = groups.find(g => g.name.toLowerCase() === groupName.toLowerCase());

    if (!group) {
      await ctx.reply(`❌ Group "${MessageBuilder.escapeMarkdownV2(groupName)}" not found or you are not a member of it.`, { parse_mode: 'MarkdownV2' });
      return;
    }

    const escapedName = MessageBuilder.escapeMarkdownV2(group.name);
    const escapedDesc = MessageBuilder.escapeMarkdownV2(group.description || 'No description');
    const escapedCurr = MessageBuilder.escapeMarkdownV2(group.defaultCurrency);
    let text = `*Group:* *${escapedName}*\n`;
    text += `*Desc:* ${escapedDesc}\n`;
    text += `*Currency:* \`${escapedCurr}\`\n\n`;
    text += `*Members roster:*\n`;

    for (const m of group.members) {
      const name = MessageBuilder.escapeMarkdownV2(m.displayName);
      const status = m.status === 'ACTIVE' ? '' : ` \\(${m.status.toLowerCase()}\\)`;
      text += `• ${name}${status}\n`;
    }

    await ctx.reply(text, { parse_mode: 'MarkdownV2' });
  }
}

@Injectable()
@TelegramCommand({
  command: 'split',
  category: 'splitter',
  cooldown: 2,
  description: 'Split an expense: /split <description> <amount> or /split <group_name> <description> <amount>',
})
export class SplitCommandHandler implements TelegramCommandHandler {
  constructor(private readonly splitterService: SplitterService) {}

  async handle(ctx: TelegramContext) {
    if (!ctx.user) {
      await ctx.reply('❌ Authentication failed.');
      return;
    }

    const msgText = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const args = msgText.replace(/^\/split\s*/i, '').trim();

    // Regex 1: /split <group> <desc> <amount> (if multiple groups)
    // Regex 2: /split <desc> <amount> (if single group)
    const groups = await this.splitterService.listGroups(ctx.user.id);
    if (groups.length === 0) {
      await ctx.reply('ℹ️ You do not belong to any expense splitter groups. Create one in the app first!');
      return;
    }

    let targetGroup = groups[0];
    let desc = '';
    let amountStr = '';

    const parts = args.split(/\s+/);
    if (parts.length < 2) {
      await ctx.reply('⚠️ Please provide an expense description and amount, e.g. `/split Dinner 1200`', { parse_mode: 'MarkdownV2' });
      return;
    }

    // Attempt to match: /split <desc> <amount>
    const amountIndex = parts.findIndex(p => !isNaN(Number(p)));
    if (amountIndex === -1) {
      await ctx.reply('⚠️ Please provide a valid numeric amount, e.g. `/split Dinner 1200`', { parse_mode: 'MarkdownV2' });
      return;
    }

    if (amountIndex === parts.length - 1) {
      // Amount is at the end: /split [group] description amount
      amountStr = parts[amountIndex];
      // Let's check if the first part is a group name
      const possibleGroup = parts[0];
      const foundGroup = groups.find(g => g.name.toLowerCase() === possibleGroup.toLowerCase());
      if (foundGroup) {
        targetGroup = foundGroup;
        desc = parts.slice(1, amountIndex).join(' ');
      } else {
        desc = parts.slice(0, amountIndex).join(' ');
      }
    } else {
      // Amount is somewhere in the middle (fallback)
      amountStr = parts[amountIndex];
      desc = parts.filter((_, idx) => idx !== amountIndex).join(' ');
    }

    if (!desc || !amountStr) {
      await ctx.reply('⚠️ Parse error. Please use: `/split <description> <amount>`', { parse_mode: 'MarkdownV2' });
      return;
    }

    // Resolve user member ID
    const groupDetails = await this.splitterService.getGroup(ctx.user.id, targetGroup.id);
    const selfMember = groupDetails.members.find(m => m.userId === ctx.user!.id);
    if (!selfMember) {
      await ctx.reply('❌ You are not a member of the group roster.');
      return;
    }

    // Call service to create expense
    try {
      const expense = await this.splitterService.createExpense(ctx.user.id, targetGroup.id, {
        description: desc,
        currency: targetGroup.defaultCurrency,
        totalAmount: amountStr,
        splitType: 'EQUAL',
        payers: [{ memberId: selfMember.id, amountPaid: amountStr }],
        participants: groupDetails.members.map(m => ({ memberId: m.id })),
      });

      const escapedDesc = MessageBuilder.escapeMarkdownV2(expense.description);
      const escapedAmount = MessageBuilder.escapeMarkdownV2(`${expense.totalAmount} ${expense.currency}`);
      const escapedGroupName = MessageBuilder.escapeMarkdownV2(targetGroup.name);

      await ctx.reply(`✅ *Expense split successfully in group "${escapedGroupName}"\\!*\n\n*Desc:* ${escapedDesc}\n*Amount:* \`${escapedAmount}\`\n*Split type:* Equal among all ${groupDetails.members.length} members\\.`, {
        parse_mode: 'MarkdownV2',
      });
    } catch (err: any) {
      await ctx.reply(`❌ Failed to split expense: ${MessageBuilder.escapeMarkdownV2(err.message)}`, { parse_mode: 'MarkdownV2' });
    }
  }
}

@Injectable()
@TelegramCommand({
  command: 'splitbalance',
  aliases: ['groupbalance'],
  category: 'splitter',
  cooldown: 2,
  description: 'View group balances: /splitbalance <group_name>',
})
export class BalanceCommandHandler implements TelegramCommandHandler {
  constructor(private readonly splitterService: SplitterService) {}

  async handle(ctx: TelegramContext) {
    if (!ctx.user) {
      await ctx.reply('❌ Authentication failed.');
      return;
    }

    const msgText = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const groupName = msgText.replace(/^\/(splitbalance|groupbalance)\s*/i, '').trim();

    const groups = await this.splitterService.listGroups(ctx.user.id);
    if (groups.length === 0) {
      await ctx.reply('ℹ️ You do not belong to any expense splitter groups.');
      return;
    }

    let targetGroup = groups[0];
    if (groupName) {
      const found = groups.find(g => g.name.toLowerCase() === groupName.toLowerCase());
      if (!found) {
        await ctx.reply(`❌ Group "${MessageBuilder.escapeMarkdownV2(groupName)}" not found.`, { parse_mode: 'MarkdownV2' });
        return;
      }
      targetGroup = found;
    } else if (groups.length > 1) {
      await ctx.reply(`ℹ️ You belong to multiple groups. Please specify a group name, e.g. \`/splitbalance ${MessageBuilder.escapeMarkdownV2(groups[0].name)}\``, { parse_mode: 'MarkdownV2' });
      return;
    }

    try {
      const balances = await this.splitterService.getBalances(ctx.user.id, targetGroup.id);
      const debts = await this.splitterService.getSimplifiedDebts(ctx.user.id, targetGroup.id);

      const escapedGroupName = MessageBuilder.escapeMarkdownV2(targetGroup.name);
      let text = `*Balances for group "${escapedGroupName}":*\n\n`;

      for (const b of balances) {
        const name = MessageBuilder.escapeMarkdownV2(b.displayName);
        const net = b.netBalance;
        const formattedNet = MessageBuilder.escapeMarkdownV2(`${net.toFixed(2)} ${targetGroup.defaultCurrency}`);
        
        if (net.isPositive()) {
          text += `• ${name}: *gets back* \`+${formattedNet}\`\n`;
        } else if (net.isNegative()) {
          text += `• ${name}: *owes* \`${formattedNet}\`\n`;
        } else {
          text += `• ${name}: settled \`0.00 ${targetGroup.defaultCurrency}\`\n`;
        }
      }

      if (debts.length > 0) {
        text += `\n*Simplified Debts:*\n`;
        for (const d of debts) {
          const from = MessageBuilder.escapeMarkdownV2(d.fromDisplayName);
          const to = MessageBuilder.escapeMarkdownV2(d.toDisplayName);
          const amt = MessageBuilder.escapeMarkdownV2(`${d.amount.toFixed(2)} ${targetGroup.defaultCurrency}`);
          text += `• ${from} owes ${to} \`${amt}\`\n`;
        }
      } else {
        text += `\n✅ *All settled up\\!*`;
      }

      await ctx.reply(text, { parse_mode: 'MarkdownV2' });
    } catch (err: any) {
      await ctx.reply(`❌ Failed to retrieve balances: ${MessageBuilder.escapeMarkdownV2(err.message)}`, { parse_mode: 'MarkdownV2' });
    }
  }
}

@Injectable()
@TelegramCommand({
  command: 'settle',
  category: 'splitter',
  cooldown: 2,
  description: 'Settle a debt: /settle <friend_name> <amount> or /settle <group_name> <friend_name> <amount>',
})
export class SettleCommandHandler implements TelegramCommandHandler {
  constructor(private readonly splitterService: SplitterService) {}

  async handle(ctx: TelegramContext) {
    if (!ctx.user) {
      await ctx.reply('❌ Authentication failed.');
      return;
    }

    const msgText = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const args = msgText.replace(/^\/settle\s*/i, '').trim();

    const groups = await this.splitterService.listGroups(ctx.user.id);
    if (groups.length === 0) {
      await ctx.reply('ℹ️ You do not belong to any expense splitter groups.');
      return;
    }

    const parts = args.split(/\s+/);
    if (parts.length < 2) {
      await ctx.reply('⚠️ Please specify whom you are settling with and the amount, e.g. `/settle Aman 500`', { parse_mode: 'MarkdownV2' });
      return;
    }

    let targetGroup = groups[0];
    let receiverName = '';
    let amountStr = '';

    // Check if first part matches a group name
    const possibleGroup = parts[0];
    const foundGroup = groups.find(g => g.name.toLowerCase() === possibleGroup.toLowerCase());
    
    if (foundGroup) {
      targetGroup = foundGroup;
      receiverName = parts[1];
      amountStr = parts[2];
    } else {
      receiverName = parts[0];
      amountStr = parts[1];
      if (groups.length > 1) {
        await ctx.reply(`ℹ️ You belong to multiple groups. Please specify group name, e.g. \`/settle ${MessageBuilder.escapeMarkdownV2(groups[0].name)} ${MessageBuilder.escapeMarkdownV2(receiverName)} ${amountStr}\``, { parse_mode: 'MarkdownV2' });
        return;
      }
    }

    if (!receiverName || !amountStr || isNaN(Number(amountStr))) {
      await ctx.reply('⚠️ Please provide a valid name and settlement amount, e.g. `/settle Aman 500`', { parse_mode: 'MarkdownV2' });
      return;
    }

    // Fetch full group roster to resolve members
    const groupDetails = await this.splitterService.getGroup(ctx.user.id, targetGroup.id);
    const selfMember = groupDetails.members.find(m => m.userId === ctx.user!.id);
    if (!selfMember) {
      await ctx.reply('❌ You are not a member of this group.');
      return;
    }

    const receiverMember = groupDetails.members.find(
      m => m.displayName.toLowerCase().includes(receiverName.toLowerCase())
    );

    if (!receiverMember) {
      await ctx.reply(`❌ Member "${MessageBuilder.escapeMarkdownV2(receiverName)}" not found in the group roster.`, { parse_mode: 'MarkdownV2' });
      return;
    }

    // Call service to create settlement
    try {
      const settlement = await this.splitterService.createSettlement(ctx.user.id, targetGroup.id, {
        payerMemberId: selfMember.id,
        receiverMemberId: receiverMember.id,
        amount: amountStr,
        currency: targetGroup.defaultCurrency,
        syncToFinance: true, // auto sync personal finance ledger when settling via bot
        notes: `Telegram Settlement`,
      });

      // Complete the settlement immediately (as bot processes instantaneous cash exchanges)
      const completed = await this.splitterService.completeSettlement(ctx.user.id, targetGroup.id, settlement.id, settlement.version);

      if (!completed) {
        throw new Error('Settlement could not be completed');
      }

      const fromName = MessageBuilder.escapeMarkdownV2(selfMember.displayName);
      const toName = MessageBuilder.escapeMarkdownV2(receiverMember.displayName);
      const escapedAmount = MessageBuilder.escapeMarkdownV2(`${completed.amount} ${completed.currency}`);

      await ctx.reply(`✅ *Settlement recorded & completed\\!*\n\n${fromName} paid ${toName} \`${escapedAmount}\`\\.\nPersonal finance transactions auto\\-synced\\.`, {
        parse_mode: 'MarkdownV2',
      });
    } catch (err: any) {
      await ctx.reply(`❌ Failed to record settlement: ${MessageBuilder.escapeMarkdownV2(err.message)}`, { parse_mode: 'MarkdownV2' });
    }
  }
}
