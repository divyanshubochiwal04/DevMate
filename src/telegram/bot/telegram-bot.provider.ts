import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { ConfigService } from '../../config/config.service';
import { CustomLogger } from '../../common/logger/custom-logger.service';
import { TelegramContext } from '../interfaces/telegram-context.interface';
import { TelegramRouterService } from '../commands/telegram-router.service';
import { ErrorMiddleware } from '../middlewares/error.middleware';
import { LoggingMiddleware } from '../middlewares/logging.middleware';
import { RateLimitMiddleware } from '../middlewares/rate-limit.middleware';
import { AuthMiddleware } from '../middlewares/auth.middleware';
import { ConversationMiddleware } from '../middlewares/conversation.middleware';

@Injectable()
export class TelegramBotProvider implements OnModuleInit, OnModuleDestroy {
  private botInstance!: Telegraf<TelegramContext>;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: CustomLogger,
    private readonly routerService: TelegramRouterService,
    private readonly errorMiddleware: ErrorMiddleware,
    private readonly loggingMiddleware: LoggingMiddleware,
    private readonly rateLimitMiddleware: RateLimitMiddleware,
    private readonly authMiddleware: AuthMiddleware,
    private readonly conversationMiddleware: ConversationMiddleware
  ) {
    this.logger.setContext('TelegramBotProvider');
    this.initializeBot();
  }

  private initializeBot() {
    const token = this.configService.telegramBotToken;

    if (!token || token === 'CHANGE_ME_TELEGRAM_BOT_TOKEN' || token.trim() === '') {
      const errorMessage = 'CRITICAL: TELEGRAM_BOT_TOKEN is missing or has the default placeholder value. Application cannot boot.';
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    this.logger.log('Initializing Telegraf instance...');
    this.botInstance = new Telegraf<TelegramContext>(token);

    // Register middleware pipeline in the explicit execution order
    this.botInstance.use(async (ctx, next) => {
      await this.errorMiddleware.use(ctx, next);
    });

    this.botInstance.use(async (ctx, next) => {
      await this.loggingMiddleware.use(ctx, next);
    });

    this.botInstance.use(async (ctx, next) => {
      await this.rateLimitMiddleware.use(ctx, next);
    });

    this.botInstance.use(async (ctx, next) => {
      await this.authMiddleware.use(ctx, next);
    });

    this.botInstance.use(async (ctx, next) => {
      await this.conversationMiddleware.use(ctx, next);
    });

    // Wire up update receiver to route all events to TelegramRouterService as terminal middleware
    this.botInstance.use(async (ctx) => {
      await this.routerService.handleUpdate(ctx);
    });
  }

  getBotInstance(): Telegraf<TelegramContext> {
    return this.botInstance;
  }

  async onModuleInit() {
    if (process.env.NODE_ENV === 'test') {
      this.logger.log('Running in TEST mode. Skipping Telegraf polling launch.');
      return;
    }

    this.logger.log('Starting Telegraf polling...');
    this.botInstance.launch().catch((err) => {
      this.logger.error(`Failed to launch Telegram bot: ${err.message}`, err.stack);
    });
    this.logger.log('Telegram Bot successfully launched in polling mode!');
  }

  async onModuleDestroy() {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    this.logger.log('Stopping Telegraf bot...');
    try {
      await this.botInstance.stop('SIGTERM');
    } catch (e) {
      // Ignore
    }
    this.logger.log('Telegraf bot successfully stopped!');
  }
}
