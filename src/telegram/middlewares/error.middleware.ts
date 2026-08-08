import { Injectable } from '@nestjs/common';
import { TelegramContext } from '../interfaces/telegram-context.interface';
import { CustomLogger } from '../../common/logger/custom-logger.service';

@Injectable()
export class ErrorMiddleware {
  constructor(private readonly logger: CustomLogger) {
    this.logger.setContext('ErrorMiddleware');
  }

  async use(ctx: TelegramContext, next: () => Promise<void>): Promise<void> {
    try {
      await next();
    } catch (error: any) {
      this.logger.error(`Error processing update: ${error.message || error}`, error.stack);
      try {
        await ctx.reply('⚠️ An unexpected error occurred while processing your request. Please try again later.');
      } catch (replyError: any) {
        this.logger.error('Failed to send error reply to user', replyError?.stack || String(replyError));
      }
    }
  }
}
