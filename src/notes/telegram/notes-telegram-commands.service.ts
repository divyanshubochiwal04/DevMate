import { Injectable } from '@nestjs/common';
import { TelegramCommand } from '../../telegram/commands/decorators/telegram-command.decorator';
import { TelegramCommandHandler } from '../../telegram/interfaces/command-handler.interface';
import { TelegramContext } from '../../telegram/interfaces/telegram-context.interface';
import { NotesService } from '../services/notes.service';
import { MessageBuilder } from '../../telegram/builders/message.builder';

@Injectable()
@TelegramCommand({
  command: 'note',
  aliases: ['addnote'],
  category: 'knowledge',
  cooldown: 2,
  description: 'Create a new note: /note <title>',
})
export class NoteCommandHandler implements TelegramCommandHandler {
  constructor(private readonly notesService: NotesService) {}

  async handle(ctx: TelegramContext) {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const title = text.replace(/^\/(note|addnote)\s*/i, '').trim();

    if (!title) {
      await ctx.reply('⚠️ Please provide a note title, e.g.\n`/note Meetup plans`', { parse_mode: 'MarkdownV2' });
      return;
    }

    if (!ctx.user) {
      await ctx.reply('❌ Authentication failed. User context not resolved.');
      return;
    }

    const note = await this.notesService.createNote(ctx.user.id, {
      title,
      content: '', // default empty
    });

    await ctx.reply(`✅ Note created successfully!\n\n*Title:* ${MessageBuilder.escapeMarkdownV2(note.title)}\n*ID:* \`${note.id}\``, {
      parse_mode: 'MarkdownV2',
    });
  }
}

@Injectable()
@TelegramCommand({
  command: 'notes',
  category: 'knowledge',
  cooldown: 3,
  description: 'List your notes: /notes',
})
export class NotesCommandHandler implements TelegramCommandHandler {
  constructor(private readonly notesService: NotesService) {}

  async handle(ctx: TelegramContext) {
    if (!ctx.user) {
      await ctx.reply('❌ Authentication failed.');
      return;
    }

    const notes = await this.notesService.listNotes(ctx.user.id, {});
    
    if (notes.length === 0) {
      await ctx.reply('📝 You have no notes!');
      return;
    }

    let response = '📝 *Your Notes:*\n\n';
    notes.forEach((note, idx) => {
      response += `${idx + 1}\\. *${MessageBuilder.escapeMarkdownV2(note.title)}*\n   _ID:_ \`${note.id}\`\n\n`;
    });

    await ctx.reply(response, { parse_mode: 'MarkdownV2' });
  }
}

@Injectable()
@TelegramCommand({
  command: 'findnote',
  category: 'knowledge',
  cooldown: 2,
  description: 'Find a note by keyword: /findnote <keyword>',
})
export class FindNoteCommandHandler implements TelegramCommandHandler {
  constructor(private readonly notesService: NotesService) {}

  async handle(ctx: TelegramContext) {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const keyword = text.replace(/^\/findnote\s*/i, '').trim();

    if (!keyword) {
      await ctx.reply('⚠️ Please provide a search keyword, e.g.\n`/findnote balance`', { parse_mode: 'MarkdownV2' });
      return;
    }

    if (!ctx.user) {
      await ctx.reply('❌ Authentication failed.');
      return;
    }

    const notes = await this.notesService.listNotes(ctx.user.id, { keyword });

    if (notes.length === 0) {
      await ctx.reply(`🔍 No notes found matching "${MessageBuilder.escapeMarkdownV2(keyword)}".`);
      return;
    }

    let response = `🔍 *Search Results for "${MessageBuilder.escapeMarkdownV2(keyword)}":*\n\n`;
    notes.forEach((note, idx) => {
      response += `${idx + 1}\\. *${MessageBuilder.escapeMarkdownV2(note.title)}*\n   _ID:_ \`${note.id}\`\n\n`;
    });

    await ctx.reply(response, { parse_mode: 'MarkdownV2' });
  }
}
