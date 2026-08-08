import { Injectable } from '@nestjs/common';
import { TelegramContext } from '../interfaces/telegram-context.interface';
import { ConversationService } from '../conversations/conversation.service';
import { CustomLogger } from '../../common/logger/custom-logger.service';

@Injectable()
export class ConversationMiddleware {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly logger: CustomLogger
  ) {
    this.logger.setContext('ConversationMiddleware');
  }

  async use(ctx: TelegramContext, next: () => Promise<void>): Promise<void> {
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;

    if (!userId || !chatId) {
      return next();
    }

    const ctxState = ctx.state as any;
    ctxState.conversationService = this.conversationService;

    // Load conversation state
    let conversation = await this.conversationService.getConversationState(BigInt(userId), BigInt(chatId));

    if (conversation) {
      // Timeout check (15 minutes = 900,000 milliseconds)
      const TIMEOUT_MS = 15 * 60 * 1000;
      const lastUpdate = conversation.updatedAt ? new Date(conversation.updatedAt).getTime() : Date.now();
      const timeSinceUpdate = Date.now() - lastUpdate;

      if (timeSinceUpdate > TIMEOUT_MS) {
        this.logger.log(`Conversation session for User ${userId} timed out due to inactivity.`);
        await this.conversationService.clearConversationState(BigInt(userId), BigInt(chatId));
        await ctx.reply('⏰ Conversation session timed out due to inactivity.');
        conversation = null;
      }
    }

    ctx.conversation = conversation || undefined;

    ctx.transitionTo = async (nextState: string, data?: Record<string, any>) => {
      await this.conversationService.transitionTo(BigInt(userId), BigInt(chatId), nextState, data);
      const updated = await this.conversationService.getConversationState(BigInt(userId), BigInt(chatId));
      ctx.conversation = updated || undefined;
    };

    await next();

    // Persist conversation changes if updated during handler execution
    if (ctx.conversation) {
      await this.conversationService.setConversationState(BigInt(userId), BigInt(chatId), ctx.conversation);
    }
  }
}
