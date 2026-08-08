import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { ICommandRegistry } from '../interfaces/command-registry.interface';
import { IEventBus } from '../interfaces/event-bus.interface';
import { TelegramContext } from '../interfaces/telegram-context.interface';
import { TELEGRAM_COMMAND_METADATA } from './decorators/telegram-command.decorator';
import { TELEGRAM_EVENT_LISTENER_METADATA } from '../events/telegram-event-listener.decorator';
import { CustomLogger } from '../../common/logger/custom-logger.service';

@Injectable()
export class TelegramRouterService implements OnModuleInit {
  private readonly cooldowns = new Map<string, number>();

  constructor(
    private readonly modulesContainer: ModulesContainer,
    @Inject(ICommandRegistry) private readonly registry: ICommandRegistry,
    @Inject(IEventBus) private readonly eventBus: IEventBus,
    private readonly logger: CustomLogger
  ) {
    this.logger.setContext('TelegramRouterService');
  }

  onModuleInit() {
    this.logger.log('Scanning for Telegram Command Handlers and Event Listeners...');
    const modules = [...this.modulesContainer.values()];
    let commandCount = 0;
    let listenerCount = 0;

    for (const module of modules) {
      for (const provider of module.providers.values()) {
        const instance = provider.instance;
        if (!instance) continue;
        const target = instance.constructor;

        const instanceAny = instance as any;

        // 1. Scan command decorators (on class level)
        const cmdMetadata = Reflect.getMetadata(TELEGRAM_COMMAND_METADATA, target);
        if (cmdMetadata) {
          this.registry.register(cmdMetadata.command, instanceAny, cmdMetadata);
          commandCount++;
          this.logger.log(`Registered command: /${cmdMetadata.command} (aliases: ${cmdMetadata.aliases?.join(', ') || 'none'})`);
        }

        // 2. Scan event listener decorators (on method level)
        const prototype = Object.getPrototypeOf(instance);
        if (!prototype) continue;
        const methods = Object.getOwnPropertyNames(prototype);

        for (const method of methods) {
          if (typeof instanceAny[method] !== 'function' || method === 'constructor') continue;
          
          const eventName = Reflect.getMetadata(TELEGRAM_EVENT_LISTENER_METADATA, instanceAny[method]);
          if (eventName) {
            this.eventBus.subscribe(eventName, async (payload) => {
              try {
                await instanceAny[method](payload);
              } catch (error: any) {
                this.logger.error(`Error in event listener for ${eventName}: ${error.message || error}`);
              }
            });
            listenerCount++;
            this.logger.log(`Registered event listener: ${eventName} -> ${target.name}.${method}()`);
          }
        }
      }
    }
    
    this.logger.log(`Successfully registered ${commandCount} commands and ${listenerCount} event listeners!`);
  }

  async handleUpdate(ctx: TelegramContext): Promise<void> {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const isCommand = text.startsWith('/');
    const commandName = isCommand ? text.split(' ')[0].substring(1).split('@')[0] : '';

    // 1. Bypass commands check (e.g., /cancel, /start)
    const isBypass = commandName === 'cancel' || commandName === 'start';

    if (isBypass && ctx.conversation) {
      this.logger.log(`Bypassing active conversation for user ${ctx.from?.id} via /${commandName}`);
      if (ctx.state?.conversationService) {
        await ctx.state.conversationService.clearConversationState(BigInt(ctx.from!.id), BigInt(ctx.chat!.id));
      }
      ctx.conversation = undefined;
    }

    // 2. Active conversation routing
    if (ctx.conversation && ctx.conversation.currentState !== 'START') {
      const handlerId = ctx.conversation.handlerId;
      if (handlerId) {
        const command = this.registry.get(handlerId);
        if (command && typeof command.handler.handle === 'function') {
          this.logger.debug(`Routing update to conversation handler: ${handlerId} (user: ${ctx.from?.id})`);
          await command.handler.handle(ctx);
          return;
        }
      }
    }

    // 3. Command routing
    if (isCommand) {
      const command = this.registry.get(commandName);
      if (command) {
        // Enforce adminOnly
        if (command.metadata.adminOnly) {
          const isSuperAdmin = ctx.user?.isSuperAdmin;
          const isAdmin = ctx.user?.roles?.includes('ADMIN') || ctx.user?.roles?.includes('SUPER_ADMIN');
          if (!isSuperAdmin && !isAdmin) {
            this.logger.warn(`User ${ctx.from?.id} blocked from admin command /${commandName}`);
            await ctx.reply('❌ This command is restricted to administrators.');
            return;
          }
        }

        // Enforce permissions
        if (command.metadata.permissions && command.metadata.permissions.length > 0) {
          const userPermissions = ctx.user?.permissions || [];
          const hasAllPerms = command.metadata.permissions.every(p => userPermissions.includes(p));
          if (!ctx.user?.isSuperAdmin && !hasAllPerms) {
            this.logger.warn(`User ${ctx.from?.id} lacks permissions for command /${commandName}`);
            await ctx.reply('❌ You do not have the required permissions to execute this command.');
            return;
          }
        }

        // Enforce cooldown
        if (command.metadata.cooldown) {
          const now = Date.now();
          const cooldownKey = `${ctx.from?.id}:${commandName}`;
          const expiresAt = this.cooldowns.get(cooldownKey) || 0;
          if (now < expiresAt) {
            const remaining = Math.ceil((expiresAt - now) / 1000);
            await ctx.reply(`⚠️ Please wait ${remaining}s before using /${commandName} again.`);
            return;
          }
          this.cooldowns.set(cooldownKey, now + command.metadata.cooldown * 1000);
        }

        this.logger.log(`Routing command: /${commandName} (user: ${ctx.from?.id})`);
        await command.handler.handle(ctx);
        return;
      }
    }

    // 4. Default Fallback
    if (isCommand) {
      await ctx.reply(`❌ Unknown command. Type /help to see available options.`);
    } else {
      this.logger.debug(`Unhandled text message from ${ctx.from?.id}: ${text}`);
    }
  }
}
