import { Injectable, Inject } from '@nestjs/common';
import { TelegramContext } from '../interfaces/telegram-context.interface';
import { IRateLimiter } from '../interfaces/rate-limiter.interface';
import { CustomLogger } from '../../common/logger/custom-logger.service';

@Injectable()
export class RateLimitMiddleware {
  constructor(
    @Inject(IRateLimiter) private readonly rateLimiter: IRateLimiter,
    private readonly logger: CustomLogger
  ) {
    this.logger.setContext('RateLimitMiddleware');
  }

  async use(ctx: TelegramContext, next: () => Promise<void>): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) {
      return next();
    }

    // Limit to 5 requests per 1 second window
    const limit = 5;
    const windowMs = 1000;

    const isLimited = await this.rateLimiter.isRateLimited(String(userId), limit, windowMs);
    if (isLimited) {
      this.logger.warn(`User ${userId} rate limited!`);
      await ctx.reply('⚠️ You are sending messages too quickly. Please slow down.');
      return;
    }

    await next();
  }
}
