import { Injectable } from '@nestjs/common';
import { TelegramCommand } from '../../telegram/commands/decorators/telegram-command.decorator';
import { TelegramCommandHandler } from '../../telegram/interfaces/command-handler.interface';
import { TelegramContext } from '../../telegram/interfaces/telegram-context.interface';
import { CalendarService } from '../services/calendar.service';
import { MessageBuilder } from '../../telegram/builders/message.builder';
import { RecurrenceFrequency } from '@prisma/client';

@Injectable()
@TelegramCommand({
  command: 'calendar',
  category: 'productivity',
  cooldown: 2,
  description: 'View calendars list: /calendar',
})
export class CalendarListCommandHandler implements TelegramCommandHandler {
  constructor(private readonly service: CalendarService) {}

  async handle(ctx: TelegramContext) {
    if (!ctx.user) {
      await ctx.reply('❌ Authentication failed.');
      return;
    }

    try {
      const calendars = await this.service.listCalendars(ctx.user.id);
      let response = '📅 *Your Calendars:*\n\n';
      
      calendars.forEach((c: any, idx: number) => {
        const defMarker = c.isDefault ? ' *[Default]*' : '';
        response += `${idx + 1}\\. *${MessageBuilder.escapeMarkdownV2(c.name)}*${defMarker}\n`;
        response += `   _TZ:_ \`${MessageBuilder.escapeMarkdownV2(c.timezone)}\` | _Type:_ \`${c.type}\`\n\n`;
      });

      await ctx.reply(response, { parse_mode: 'MarkdownV2' });
    } catch (err: any) {
      await ctx.reply(`❌ Error: ${err.message}`);
    }
  }
}

@Injectable()
@TelegramCommand({
  command: 'today',
  category: 'productivity',
  cooldown: 2,
  description: 'Show agenda for today: /today',
})
export class TodayCommandHandler implements TelegramCommandHandler {
  constructor(private readonly service: CalendarService) {}

  async handle(ctx: TelegramContext) {
    if (!ctx.user) {
      await ctx.reply('❌ Authentication failed.');
      return;
    }

    try {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

      const result = await this.service.listEvents(ctx.user.id, {
        from: start.toISOString(),
        to: end.toISOString(),
      });

      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const dateHeader = `📅 *Today — ${now.getUTCDate()} ${months[now.getUTCMonth()]}*\n\n`;

      if (result.items.length === 0) {
        await ctx.reply(`${dateHeader}📋 You have no events scheduled for today.`);
        return;
      }

      let response = dateHeader;
      result.items.forEach((evt) => {
        const timeStr = evt.isAllDay
          ? 'All Day'
          : `${String(new Date(evt.startAt).getUTCHours()).padStart(2, '0')}:${String(new Date(evt.startAt).getUTCMinutes()).padStart(2, '0')}`;
        response += `*${timeStr}*  ${MessageBuilder.escapeMarkdownV2(evt.title)}\n`;
      });

      await ctx.reply(response, { parse_mode: 'MarkdownV2' });
    } catch (err: any) {
      await ctx.reply(`❌ Error: ${err.message}`);
    }
  }
}

@Injectable()
@TelegramCommand({
  command: 'tomorrow',
  category: 'productivity',
  cooldown: 2,
  description: 'Show agenda for tomorrow: /tomorrow',
})
export class TomorrowCommandHandler implements TelegramCommandHandler {
  constructor(private readonly service: CalendarService) {}

  async handle(ctx: TelegramContext) {
    if (!ctx.user) {
      await ctx.reply('❌ Authentication failed.');
      return;
    }

    try {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const start = new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 0, 0, 0));
      const end = new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate(), 23, 59, 59, 999));

      const result = await this.service.listEvents(ctx.user.id, {
        from: start.toISOString(),
        to: end.toISOString(),
      });

      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const dateHeader = `📅 *Tomorrow — ${tomorrow.getUTCDate()} ${months[tomorrow.getUTCMonth()]}*\n\n`;

      if (result.items.length === 0) {
        await ctx.reply(`${dateHeader}📋 You have no events scheduled for tomorrow.`);
        return;
      }

      let response = dateHeader;
      result.items.forEach((evt) => {
        const timeStr = evt.isAllDay
          ? 'All Day'
          : `${String(new Date(evt.startAt).getUTCHours()).padStart(2, '0')}:${String(new Date(evt.startAt).getUTCMinutes()).padStart(2, '0')}`;
        response += `*${timeStr}*  ${MessageBuilder.escapeMarkdownV2(evt.title)}\n`;
      });

      await ctx.reply(response, { parse_mode: 'MarkdownV2' });
    } catch (err: any) {
      await ctx.reply(`❌ Error: ${err.message}`);
    }
  }
}

@Injectable()
@TelegramCommand({
  command: 'events',
  category: 'productivity',
  cooldown: 2,
  description: 'Search upcoming events: /events <keyword>',
})
export class EventsCommandHandler implements TelegramCommandHandler {
  constructor(private readonly service: CalendarService) {}

  async handle(ctx: TelegramContext) {
    if (!ctx.user) {
      await ctx.reply('❌ Authentication failed.');
      return;
    }

    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const keyword = text.replace(/^\/events\s*/i, '').trim();

    try {
      const from = new Date().toISOString();
      const to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days window

      const result = await this.service.listEvents(ctx.user.id, {
        from,
        to,
        search: keyword || undefined,
      });

      if (result.items.length === 0) {
        await ctx.reply('📋 No upcoming events found.');
        return;
      }

      let response = `📅 *Upcoming Agenda${keyword ? ` for "${MessageBuilder.escapeMarkdownV2(keyword)}"` : ''}:*\n\n`;
      result.items.forEach((evt, idx) => {
        const dateStr = new Date(evt.startAt).toISOString().split('T')[0];
        const timeStr = evt.isAllDay
          ? 'All Day'
          : `${String(new Date(evt.startAt).getUTCHours()).padStart(2, '0')}:${String(new Date(evt.startAt).getUTCMinutes()).padStart(2, '0')}`;
        response += `${idx + 1}\\. *${dateStr}* at *${timeStr}*: *${MessageBuilder.escapeMarkdownV2(evt.title)}*\n   _ID:_ \`${evt.id}\`\n\n`;
      });

      await ctx.reply(response, { parse_mode: 'MarkdownV2' });
    } catch (err: any) {
      await ctx.reply(`❌ Error: ${err.message}`);
    }
  }
}

@Injectable()
@TelegramCommand({
  command: 'event',
  category: 'productivity',
  cooldown: 2,
  description: 'View event details: /event <id>',
})
export class EventDetailsCommandHandler implements TelegramCommandHandler {
  constructor(private readonly service: CalendarService) {}

  async handle(ctx: TelegramContext) {
    if (!ctx.user) {
      await ctx.reply('❌ Authentication failed.');
      return;
    }

    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const eventId = text.replace(/^\/event\s*/i, '').trim();

    if (!eventId) {
      await ctx.reply('⚠️ Please provide an event ID, e.g.\n`/event <id>`', { parse_mode: 'MarkdownV2' });
      return;
    }

    try {
      const evt = await this.service.getEventById(ctx.user.id, eventId);

      let response = `📅 *Event Details:*\n\n`;
      response += `*Title:* ${MessageBuilder.escapeMarkdownV2(evt.title)}\n`;
      if (evt.description) {
        response += `*Description:* ${MessageBuilder.escapeMarkdownV2(evt.description)}\n`;
      }
      response += `*Start:* \`${new Date(evt.startAt).toISOString()}\`\n`;
      response += `*End:* \`${new Date(evt.endAt).toISOString()}\`\n`;
      response += `*TZ:* \`${MessageBuilder.escapeMarkdownV2(evt.timezone)}\`\n`;
      response += `*All Day:* \`${evt.isAllDay}\`\n`;
      response += `*Status:* \`${evt.status}\`\n`;
      response += `*Type:* \`${evt.type}\`\n`;
      if (evt.locationName) {
        response += `*Location:* ${MessageBuilder.escapeMarkdownV2(evt.locationName)}\n`;
      }
      response += `*Version:* \`${evt.version}\`\n`;

      await ctx.reply(response, { parse_mode: 'MarkdownV2' });
    } catch (err: any) {
      await ctx.reply('❌ Event not found or access denied.');
    }
  }
}

@Injectable()
@TelegramCommand({
  command: 'addevent',
  aliases: ['newevent'],
  category: 'productivity',
  cooldown: 2,
  description: 'Quick add event: /addevent <title> [| startAt | endAt]',
})
export class AddEventCommandHandler implements TelegramCommandHandler {
  constructor(private readonly service: CalendarService) {}

  async handle(ctx: TelegramContext) {
    if (!ctx.user) {
      await ctx.reply('❌ Authentication failed.');
      return;
    }

    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const argText = text.replace(/^\/addevent\s*/i, '').trim();

    if (!argText) {
      await ctx.reply('⚠️ Syntax:\n`/addevent Meeting with Team` or\n`/addevent Standup | 2026-08-04T10:00:00Z | 2026-08-04T10:30:00Z`', { parse_mode: 'MarkdownV2' });
      return;
    }

    try {
      let title = argText;
      let startAt = new Date();
      let endAt = new Date(startAt.getTime() + 60 * 60 * 1000); // default 1 hour duration

      if (argText.includes('|')) {
        const parts = argText.split('|').map(p => p.trim());
        title = parts[0];
        if (parts[1]) {
          startAt = new Date(parts[1]);
        }
        if (parts[2]) {
          endAt = new Date(parts[2]);
        } else {
          endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
        }
      }

      if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) {
        throw new Error('Invalid startAt or endAt date format. Use ISO format.');
      }

      const defaultCal = await this.service.ensureDefaultCalendarExists(ctx.user.id);

      const event = await this.service.createEvent(ctx.user.id, {
        calendarId: defaultCal.id,
        title,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        recurrenceFrequency: RecurrenceFrequency.NONE,
      });

      if (!event) {
        throw new Error('Failed to create event.');
      }

      await ctx.reply(`✅ Event created successfully\\!\n\n*Title:* ${MessageBuilder.escapeMarkdownV2(event.title)}\n*ID:* \`${event.id}\``, {
        parse_mode: 'MarkdownV2',
      });
    } catch (err: any) {
      await ctx.reply(`❌ Failed to create event: ${MessageBuilder.escapeMarkdownV2(err.message)}`, { parse_mode: 'MarkdownV2' });
    }
  }
}
