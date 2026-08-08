import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../database/prisma.module';
import { RbacModule } from '../rbac/rbac.module';
import { CustomLogger } from '../common/logger/custom-logger.service';

// Abstractions
import { ITelegramGateway } from './interfaces/telegram-gateway.interface';
import { IEventBus } from './interfaces/event-bus.interface';
import { IRateLimiter } from './interfaces/rate-limiter.interface';
import { IConversationStorage } from './conversations/conversation-storage.interface';
import { ICommandRegistry } from './interfaces/command-registry.interface';

// Implementations & Services
import { TelegrafTelegramGateway } from './bot/telegraf-gateway.service';
import { LocalEventBus } from './events/local-event-bus.service';
import { MemoryRateLimiter } from './services/memory-rate-limiter.service';
import { PrismaConversationStorage } from './conversations/prisma-conversation-storage';
import { CommandRegistryService } from './commands/command-registry.service';
import { BotService } from './services/bot.service';
import { ConversationService } from './conversations/conversation.service';
import { TelegramRouterService } from './commands/telegram-router.service';
import { TelegramBotProvider } from './bot/telegram-bot.provider';

// Middlewares
import { ErrorMiddleware } from './middlewares/error.middleware';
import { LoggingMiddleware } from './middlewares/logging.middleware';
import { RateLimitMiddleware } from './middlewares/rate-limit.middleware';
import { AuthMiddleware } from './middlewares/auth.middleware';
import { ConversationMiddleware } from './middlewares/conversation.middleware';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule, RbacModule],
  providers: [
    CustomLogger,
    
    // Core Abstraction Bindings
    {
      provide: ITelegramGateway,
      useClass: TelegrafTelegramGateway,
    },
    {
      provide: IEventBus,
      useClass: LocalEventBus,
    },
    {
      provide: IRateLimiter,
      useClass: MemoryRateLimiter,
    },
    {
      provide: IConversationStorage,
      useClass: PrismaConversationStorage,
    },
    {
      provide: ICommandRegistry,
      useClass: CommandRegistryService,
    },

    // Services
    BotService,
    ConversationService,
    TelegramRouterService,
    TelegramBotProvider,

    // Middlewares
    ErrorMiddleware,
    LoggingMiddleware,
    RateLimitMiddleware,
    AuthMiddleware,
    ConversationMiddleware,

    // Raw Bot Instance Factory
    {
      provide: 'TELEGRAM_BOT_INSTANCE',
      useFactory: (provider: TelegramBotProvider) => {
        return provider.getBotInstance();
      },
      inject: [TelegramBotProvider],
    },
  ],
  exports: [
    BotService,
    ConversationService,
    ITelegramGateway,
    IEventBus,
    IRateLimiter,
    IConversationStorage,
    ICommandRegistry,
  ],
})
export class TelegramModule {}
