import { Injectable } from '@nestjs/common';
import { TelegramContext } from '../interfaces/telegram-context.interface';
import { CustomLogger } from '../../common/logger/custom-logger.service';

@Injectable()
export class LoggingMiddleware {
  constructor(private readonly logger: CustomLogger) {
    this.logger.setContext('LoggingMiddleware');
  }

  async use(ctx: TelegramContext, next: () => Promise<void>): Promise<void> {
    const start = Date.now();
    const updateId = ctx.update.update_id;
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    const updateType = ctx.updateType;

    this.logger.debug(`[Update #${updateId}] Incoming ${updateType} from User ${userId} in Chat ${chatId}`);

    await next();

    const duration = Date.now() - start;
    this.logger.debug(`[Update #${updateId}] Processed in ${duration}ms`);
  }
}
