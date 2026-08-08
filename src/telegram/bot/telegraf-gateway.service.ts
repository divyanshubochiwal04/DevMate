import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { ITelegramGateway } from '../interfaces/telegram-gateway.interface';
import { TelegramContext } from '../interfaces/telegram-context.interface';

@Injectable()
export class TelegrafTelegramGateway implements ITelegramGateway {
  constructor(
    @Inject('TELEGRAM_BOT_INSTANCE') private readonly bot: Telegraf<TelegramContext>
  ) {}

  async sendMessage(chatId: string | number, text: string, options?: any): Promise<any> {
    return this.bot.telegram.sendMessage(chatId, text, options);
  }

  async editMessageText(chatId: string | number, messageId: number, text: string, options?: any): Promise<any> {
    return this.bot.telegram.editMessageText(chatId, messageId, undefined, text, options);
  }

  async deleteMessage(chatId: string | number, messageId: number): Promise<boolean> {
    return this.bot.telegram.deleteMessage(chatId, messageId);
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string, options?: any): Promise<boolean> {
    return this.bot.telegram.answerCbQuery(callbackQueryId, text, options);
  }

  async sendPhoto(chatId: string | number, photo: any, options?: any): Promise<any> {
    return this.bot.telegram.sendPhoto(chatId, photo, options);
  }

  async sendDocument(chatId: string | number, document: any, options?: any): Promise<any> {
    return this.bot.telegram.sendDocument(chatId, document, options);
  }

  async sendMediaGroup(chatId: string | number, media: any[], options?: any): Promise<any[]> {
    return this.bot.telegram.sendMediaGroup(chatId, media, options);
  }
}
