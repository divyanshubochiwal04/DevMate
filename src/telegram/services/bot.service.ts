import { Injectable, Inject } from '@nestjs/common';
import { ITelegramGateway } from '../interfaces/telegram-gateway.interface';
import { CustomLogger } from '../../common/logger/custom-logger.service';
import { withRetry } from '../utils/backoff-retry';

@Injectable()
export class BotService {
  constructor(
    @Inject(ITelegramGateway) private readonly gateway: ITelegramGateway,
    private readonly logger: CustomLogger
  ) {
    this.logger.setContext('BotService');
  }

  async sendMessage(chatId: string | number, text: string, options?: any): Promise<any> {
    return withRetry(() => this.gateway.sendMessage(chatId, text, options), this.logger);
  }

  async editMessage(chatId: string | number, messageId: number, text: string, options?: any): Promise<any> {
    return withRetry(() => this.gateway.editMessageText(chatId, messageId, text, options), this.logger);
  }

  async deleteMessage(chatId: string | number, messageId: number): Promise<boolean> {
    return withRetry(() => this.gateway.deleteMessage(chatId, messageId), this.logger);
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string, options?: any): Promise<boolean> {
    return withRetry(() => this.gateway.answerCallbackQuery(callbackQueryId, text, options), this.logger);
  }

  async sendPhoto(chatId: string | number, photo: any, options?: any): Promise<any> {
    return withRetry(() => this.gateway.sendPhoto(chatId, photo, options), this.logger);
  }

  async sendDocument(chatId: string | number, document: any, options?: any): Promise<any> {
    return withRetry(() => this.gateway.sendDocument(chatId, document, options), this.logger);
  }

  async sendMediaGroup(chatId: string | number, media: any[], options?: any): Promise<any[]> {
    return withRetry(() => this.gateway.sendMediaGroup(chatId, media, options), this.logger);
  }
}
