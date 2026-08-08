import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { TelegramBotProvider } from '../bot/telegram-bot.provider';
import { ICommandRegistry } from '../interfaces/command-registry.interface';
import { IEventBus } from '../interfaces/event-bus.interface';
import { TelegramCommandHandler } from '../interfaces/command-handler.interface';
import { TelegramContext } from '../interfaces/telegram-context.interface';
import { MessageBuilder } from '../builders/message.builder';
import { InlineKeyboardBuilder } from '../builders/keyboard.builder';
import { PrismaService } from '../../database/prisma.service';
import { TelegramCommand } from '../commands/decorators/telegram-command.decorator';
import { TelegramEventListener } from '../events/telegram-event-listener.decorator';
import { CustomLogger } from '../../common/logger/custom-logger.service';

import { ConversationService } from '../conversations/conversation.service';
import { ErrorMiddleware } from '../middlewares/error.middleware';
import { LoggingMiddleware } from '../middlewares/logging.middleware';
import { RateLimitMiddleware } from '../middlewares/rate-limit.middleware';
import { AuthMiddleware } from '../middlewares/auth.middleware';
import { ConversationMiddleware } from '../middlewares/conversation.middleware';

// Mock Environment Variables before loading app
process.env.NODE_ENV = 'test';
process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

// Execution sequence tracker for Middleware Order test
const middlewareSequence: string[] = [];

// A test Command Handler to verify discovery
@TelegramCommand({
  command: 'testcmd',
  aliases: ['tc', 'testalias'],
  cooldown: 0,
  description: 'Test command description',
})
class TestCommandHandler implements TelegramCommandHandler {
  public called: boolean = false;
  public lastCtx: any = null;

  async handle(ctx: TelegramContext) {
    this.called = true;
    this.lastCtx = ctx;
    middlewareSequence.push('Handler');
    await ctx.reply('✅ Command executed successfully');
  }
}

// A test Event Listener to verify event bus discovery
class TestEventListener {
  public static eventPayload: any = null;
  public static called: boolean = false;

  @TelegramEventListener('test_event')
  async onTestEvent(payload: any) {
    TestEventListener.called = true;
    TestEventListener.eventPayload = payload;
  }
}

async function runTests() {
  console.log('==================================================');
  console.log('🧪 Starting Telegram Core Engine Integration Tests');
  console.log('==================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const botProvider = app.get(TelegramBotProvider);
  const commandRegistry = app.get(ICommandRegistry);
  const eventBus = app.get(IEventBus);
  const logger = app.get(CustomLogger);
  
  logger.setContext('IntegrationTests');

  // Ensure test handler is registered
  const testHandler = new TestCommandHandler();
  commandRegistry.register('testcmd', testHandler, {
    command: 'testcmd',
    aliases: ['tc', 'testalias'],
    cooldown: 0,
    description: 'Test command description',
  });

  const testListener = new TestEventListener();
  eventBus.subscribe('test_event', async (payload: any) => {
    await testListener.onTestEvent(payload);
  });

  const bot = botProvider.getBotInstance();
  bot.botInfo = {
    id: 123456,
    is_bot: true,
    first_name: 'TestBot',
    username: 'test_bot',
    can_join_groups: true,
    can_read_all_group_messages: true,
    supports_inline_queries: true,
  };

  // Mock bot reply system to capture outgoing messages
  let replySpy: string[] = [];
  const originalReply = bot.context.reply;
  bot.context.reply = async function (text: any, extra?: any) {
    replySpy.push(String(text));
    return { message_id: 1, chat: { id: 1 }, date: Date.now() } as any;
  };

  // Setup Test User in DB
  const testTelegramId = 999999999n;
  await prisma.user.upsert({
    where: { telegramId: testTelegramId },
    update: { status: 'ACTIVE' },
    create: {
      telegramId: testTelegramId,
      firstName: 'Test',
      lastName: 'User',
      username: 'testuser',
      status: 'ACTIVE',
    },
  });

  // Verify DB clean slate for conversation state
  const prismaAny = prisma as any;
  await prismaAny.telegramConversation.deleteMany({
    where: { userId: testTelegramId },
  });

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASSED: ${message}`);
      passed++;
    } else {
      console.log(`❌ FAILED: ${message}`);
      failed++;
    }
  }

  try {
    // ──────── Test 1: Command Routing ────────
    replySpy = [];
    testHandler.called = false;
    
    await bot.handleUpdate({
      update_id: 100,
      message: {
        message_id: 100,
        date: Date.now(),
        chat: { id: 111, type: 'private', first_name: 'Test' } as any,
        from: { id: Number(testTelegramId), is_bot: false, first_name: 'Test', username: 'testuser' },
        text: '/testcmd',
      },
    } as any);

    assert(testHandler.called, 'Command handler should be called');
    assert(replySpy.includes('✅ Command executed successfully'), 'Router should send correct reply');

    // ──────── Test 2: Command Aliases ────────
    testHandler.called = false;
    await bot.handleUpdate({
      update_id: 101,
      message: {
        message_id: 101,
        date: Date.now(),
        chat: { id: 111, type: 'private', first_name: 'Test' } as any,
        from: { id: Number(testTelegramId), is_bot: false, first_name: 'Test', username: 'testuser' },
        text: '/tc',
      },
    } as any);
    assert(testHandler.called, 'Alias /tc should route to command handler');

    // ──────── Test 3: Authentication Rejection (Unregistered User) ────────
    replySpy = [];
    const unregisteredId = 888888888;
    await bot.handleUpdate({
      update_id: 102,
      message: {
        message_id: 102,
        date: Date.now(),
        chat: { id: 111, type: 'private', first_name: 'Test' } as any,
        from: { id: unregisteredId, is_bot: false, first_name: 'Unknown', username: 'unknown' },
        text: '/testcmd',
      },
    } as any);
    assert(
      replySpy.length > 0 && replySpy[0].includes('Access Denied: You are not registered'),
      'Unregistered user should get authentication rejection message'
    );

    // ──────── Test 4: Authentication Rejection (Suspended User) ────────
    replySpy = [];
    await prisma.user.update({
      where: { telegramId: testTelegramId },
      data: { status: 'SUSPENDED' },
    });

    await bot.handleUpdate({
      update_id: 103,
      message: {
        message_id: 103,
        date: Date.now(),
        chat: { id: 111, type: 'private', first_name: 'Test' } as any,
        from: { id: Number(testTelegramId), is_bot: false, first_name: 'Test', username: 'testuser' },
        text: '/testcmd',
      },
    } as any);
    assert(
      replySpy.length > 0 && replySpy[0].includes('Access Denied: Your account has been suspended'),
      'Suspended user should get suspension rejection message'
    );

    // Restore user status
    await prisma.user.update({
      where: { telegramId: testTelegramId },
      data: { status: 'ACTIVE' },
    });

    // ──────── Test 5: FSM Transitions & Conversation Engine ────────
    const conversationService = app.get(ConversationService);
    await conversationService.transitionTo(testTelegramId, 111n, 'STEP1', { foo: 'bar' });

    let state = await conversationService.getConversationState(testTelegramId, 111n);
    assert(state !== null && state.currentState === 'STEP1', 'Conversation service should save FSM state in Postgres');

    // Push state onto conversation stack
    await conversationService.pushState(testTelegramId, 111n, {
      currentState: 'SUBSTEP',
      stateData: { bar: 'baz' },
    });

    state = await conversationService.getConversationState(testTelegramId, 111n);
    assert(state !== null && state.currentState === 'SUBSTEP', 'Push state should transition to new FSM state');
    assert(state?.stackData.length === 1, 'Stack size should be 1');

    // Pop state
    await conversationService.popState(testTelegramId, 111n);
    state = await conversationService.getConversationState(testTelegramId, 111n);
    assert(state !== null && state.currentState === 'STEP1', 'Pop state should restore previous FSM state');
    assert(state?.stateData.foo === 'bar', 'Pop state should restore previous state data');

    // ──────── Test 6: Event Bus System ────────
    TestEventListener.called = false;
    await eventBus.publish('test_event', { payloadData: 'devmate' });
    assert(TestEventListener.called, 'Event listener should trigger on event emission');
    assert(TestEventListener.eventPayload.payloadData === 'devmate', 'Event payload should be delivered correctly');

    // ──────── Test 7: Formatting & Keyboard Builders ────────
    const escapedMarkdown = MessageBuilder.escapeMarkdownV2('hello_world!');
    assert(escapedMarkdown === 'hello\\_world\\!', 'MarkdownV2 escaping should escape special characters');

    const inlineKeyboard = InlineKeyboardBuilder.confirmation('yes_cb', 'no_cb');
    assert(
      !!inlineKeyboard.reply_markup.inline_keyboard[0].find(b => b.callback_data === 'yes_cb'),
      'Keyboard builder should construct confirmation buttons'
    );

    // ──────── Test 8: Middleware Order Tracking ────────
    await conversationService.clearConversationState(testTelegramId, 111n);
    middlewareSequence.length = 0;
    
    const errorMw = app.get(ErrorMiddleware);
    const loggingMw = app.get(LoggingMiddleware);
    const rateLimitMw = app.get(RateLimitMiddleware);
    const authMw = app.get(AuthMiddleware);
    const conversationMw = app.get(ConversationMiddleware);

    const originalErrorUse = errorMw.use;
    const originalLogUse = loggingMw.use;
    const originalRateUse = rateLimitMw.use;
    const originalAuthUse = authMw.use;
    const originalConvUse = conversationMw.use;

    errorMw.use = async function (ctx: any, next: any) {
      middlewareSequence.push('ErrorMiddleware');
      return originalErrorUse.call(this, ctx, next);
    };
    loggingMw.use = async function (ctx: any, next: any) {
      middlewareSequence.push('LoggingMiddleware');
      return originalLogUse.call(this, ctx, next);
    };
    rateLimitMw.use = async function (ctx: any, next: any) {
      middlewareSequence.push('RateLimitMiddleware');
      return originalRateUse.call(this, ctx, next);
    };
    authMw.use = async function (ctx: any, next: any) {
      middlewareSequence.push('AuthMiddleware');
      return originalAuthUse.call(this, ctx, next);
    };
    conversationMw.use = async function (ctx: any, next: any) {
      middlewareSequence.push('ConversationMiddleware');
      return originalConvUse.call(this, ctx, next);
    };

    // Trigger update
    await bot.handleUpdate({
      update_id: 104,
      message: {
        message_id: 104,
        date: Date.now(),
        chat: { id: 111, type: 'private', first_name: 'Test' } as any,
        from: { id: Number(testTelegramId), is_bot: false, first_name: 'Test', username: 'testuser' },
        text: '/testcmd',
      },
    } as any);

    const expectedOrder = [
      'ErrorMiddleware',
      'LoggingMiddleware',
      'RateLimitMiddleware',
      'AuthMiddleware',
      'ConversationMiddleware',
      'Handler'
    ];
    
    const isOrderCorrect = expectedOrder.every((mw, idx) => middlewareSequence[idx] === mw);
    assert(isOrderCorrect, `Middleware order should be: ${expectedOrder.join(' -> ')}`);
    if (!isOrderCorrect) {
      console.log('Actual middleware sequence:', middlewareSequence);
    }

  } catch (error) {
    console.error('❌ Test execution encountered an unhandled error:', error);
    failed++;
  } finally {
    // Restore spy
    bot.context.reply = originalReply;
    
    // Cleanup Database test entries
    await prismaAny.telegramConversation.deleteMany({
      where: { userId: testTelegramId },
    });
    await prisma.user.delete({
      where: { telegramId: testTelegramId },
    });

    await app.close();
  }

  console.log('\n==================================================');
  console.log(`🏁 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('==================================================');
  
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
