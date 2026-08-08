import { Injectable } from '@nestjs/common';
import { TelegramCommand } from '../../telegram/commands/decorators/telegram-command.decorator';
import { TelegramCommandHandler } from '../../telegram/interfaces/command-handler.interface';
import { TelegramContext } from '../../telegram/interfaces/telegram-context.interface';
import { TodoService } from '../services/todo.service';
import { TodoStatus } from '@prisma/client';
import { MessageBuilder } from '../../telegram/builders/message.builder';

@Injectable()
@TelegramCommand({
  command: 'todo',
  aliases: ['addtodo'],
  category: 'productivity',
  cooldown: 2,
  description: 'Create a new task: /todo <title>',
})
export class TodoCommandHandler implements TelegramCommandHandler {
  constructor(private readonly todoService: TodoService) {}

  async handle(ctx: TelegramContext) {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const title = text.replace(/^\/todo\s*/i, '').trim();

    if (!title) {
      await ctx.reply('⚠️ Please provide a task title, e.g.\n`/todo Buy milk`', { parse_mode: 'MarkdownV2' });
      return;
    }

    if (!ctx.user) {
      await ctx.reply('❌ Authentication failed. User context not resolved.');
      return;
    }

    const todo = await this.todoService.createTodo(ctx.user.id, { title });
    await ctx.reply(`✅ Task created successfully!\n\n*Task:* ${MessageBuilder.escapeMarkdownV2(todo.title)}\n*ID:* \`${todo.id}\``, {
      parse_mode: 'MarkdownV2',
    });
  }
}

@Injectable()
@TelegramCommand({
  command: 'tasks',
  aliases: ['todolist'],
  category: 'productivity',
  cooldown: 3,
  description: 'List your pending tasks: /tasks',
})
export class TasksCommandHandler implements TelegramCommandHandler {
  constructor(private readonly todoService: TodoService) {}

  async handle(ctx: TelegramContext) {
    if (!ctx.user) {
      await ctx.reply('❌ Authentication failed.');
      return;
    }

    const result = await this.todoService.searchTodos(ctx.user.id, { status: TodoStatus.TODO });
    
    if (result.items.length === 0) {
      await ctx.reply('📋 You have no pending tasks!');
      return;
    }

    let response = '📋 *Your Pending Tasks:*\n\n';
    result.items.forEach((task, idx) => {
      response += `${idx + 1}\\. *${MessageBuilder.escapeMarkdownV2(task.title)}*\n   _ID:_ \`${task.id}\`\n\n`;
    });

    await ctx.reply(response, { parse_mode: 'MarkdownV2' });
  }
}

@Injectable()
@TelegramCommand({
  command: 'task',
  category: 'productivity',
  cooldown: 2,
  description: 'View task details: /task <id>',
})
export class TaskCommandHandler implements TelegramCommandHandler {
  constructor(private readonly todoService: TodoService) {}

  async handle(ctx: TelegramContext) {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const taskId = text.replace(/^\/task\s*/i, '').trim();

    if (!taskId) {
      await ctx.reply('⚠️ Please provide a task ID, e.g.\n`/task <uuid>`', { parse_mode: 'MarkdownV2' });
      return;
    }

    try {
      const todo = await this.todoService.getTodoById(taskId);
      
      let response = `📋 *Task Details:*\n\n`;
      response += `*Title:* ${MessageBuilder.escapeMarkdownV2(todo.title)}\n`;
      response += `*Status:* \`${todo.status}\`\n`;
      response += `*Priority:* \`${todo.priority}\`\n`;
      if (todo.dueDate) {
        response += `*Due Date:* \`${todo.dueDate.toISOString()}\`\n`;
      }
      response += `*Version:* \`${todo.version}\``;

      await ctx.reply(response, { parse_mode: 'MarkdownV2' });
    } catch (err) {
      await ctx.reply('❌ Task not found or access denied.');
    }
  }
}
