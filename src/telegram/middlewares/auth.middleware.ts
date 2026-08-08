import { Injectable } from '@nestjs/common';
import { TelegramContext } from '../interfaces/telegram-context.interface';
import { AuthUserRepository } from '../../auth/repositories/auth-user.repository';
import { CustomLogger } from '../../common/logger/custom-logger.service';

@Injectable()
export class AuthMiddleware {
  constructor(
    private readonly authUserRepository: AuthUserRepository,
    private readonly logger: CustomLogger
  ) {
    this.logger.setContext('AuthMiddleware');
  }

  async use(ctx: TelegramContext, next: () => Promise<void>): Promise<void> {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      return next();
    }

    // Lookup user in PostgreSQL database using AuthUserRepository
    const user = await this.authUserRepository.findByTelegramIdWithRbac(BigInt(telegramId));

    if (!user) {
      this.logger.warn(`Access Denied: Unregistered Telegram user ID ${telegramId}`);
      await ctx.reply('❌ Access Denied: You are not registered in the system. Please register or contact an administrator.');
      return;
    }

    if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
      this.logger.warn(`Access Denied: User ID ${user.id} has status ${user.status}`);
      await ctx.reply('❌ Access Denied: Your account has been suspended or deactivated.');
      return;
    }

    // Resolve user to context
    ctx.user = user;
    await next();
  }
}
