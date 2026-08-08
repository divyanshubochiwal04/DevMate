import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { ReminderService } from '../services/reminder.service';
import { ReminderRepository } from '../repositories/reminder.repository';
import { ReminderSchedulerService } from '../scheduler/reminder-scheduler.service';
import { TodoService } from '../../todo/services/todo.service';
import { PrismaService } from '../../database/prisma.service';
import { IEventBus } from '../../telegram/interfaces/event-bus.interface';
import { ReminderStatus, ReminderType, ReminderFrequency, RetryStrategy } from '@prisma/client';
import { randomUUID } from 'crypto';
import { CustomLogger } from '../../common/logger/custom-logger.service';

process.env.NODE_ENV = 'test';
process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

async function runTests() {
  console.log('==================================================');
  console.log('🧪 Starting Enterprise Reminder Engine Integration Tests');
  console.log('==================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const reminderService = app.get(ReminderService);
  const reminderRepository = app.get(ReminderRepository);
  const scheduler = app.get(ReminderSchedulerService);
  const todoService = app.get(TodoService);
  const eventBus = app.get(IEventBus);
  const logger = app.get(CustomLogger);

  logger.setContext('ReminderIntegrationTests');

  // Setup Test User in DB
  const testUserUuid = '55555555-4444-3333-2222-111111111111';

  // Cleanup Database state
  const prismaAny = prisma as any;
  await prismaAny.todoDependency.deleteMany({ where: { OR: [{ todo: { userId: testUserUuid } }, { dependsOnTodo: { userId: testUserUuid } }] } });
  await prismaAny.todoComment.deleteMany({ where: { todo: { userId: testUserUuid } } });
  await prismaAny.todoAttachment.deleteMany({ where: { todo: { userId: testUserUuid } } });
  await prismaAny.todoLabel.deleteMany({ where: { todo: { userId: testUserUuid } } });
  await prismaAny.checklist.deleteMany({ where: { todo: { userId: testUserUuid } } });
  await prismaAny.todoHistory.deleteMany({ where: { todo: { userId: testUserUuid } } });
  await prismaAny.todo.deleteMany({ where: { userId: testUserUuid } });
  await prismaAny.reminderHistory.deleteMany({ where: { reminder: { userId: testUserUuid } } });
  await prismaAny.reminderRule.deleteMany({ where: { reminder: { userId: testUserUuid } } });
  await prismaAny.reminder.deleteMany({ where: { userId: testUserUuid } });
  await prismaAny.user.deleteMany({ where: { id: testUserUuid } });

  // Create clean user
  await prisma.user.create({
    data: {
      id: testUserUuid,
      telegramId: 88889999n,
      firstName: 'Alice',
      lastName: 'ReminderTester',
      username: 'aliceremind',
      status: 'ACTIVE',
    },
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
    // ──────── Test 1: CRUD & Future Date Validation ────────
    try {
      await reminderService.createReminder(testUserUuid, {
        text: 'Past Reminder',
        type: ReminderType.CUSTOM,
        triggerTime: new Date(Date.now() - 10000).toISOString(),
      });
      assert(false, 'Should throw BadRequestException on past triggerTime');
    } catch (err: any) {
      assert(err.message.includes('must be in the future'), 'Past trigger dates must be rejected');
    }

    const reminder = await reminderService.createReminder(testUserUuid, {
      text: 'Deploy production stack',
      type: ReminderType.CUSTOM,
      triggerTime: new Date(Date.now() + 600000).toISOString(), // 10 min from now
      frequency: ReminderFrequency.ONETIME,
    });
    assert(reminder.text === 'Deploy production stack', 'Should create reminder with correct text');
    assert(reminder.status === ReminderStatus.PENDING, 'Should default status to PENDING');

    // ──────── Test 2: Snooze Calculations ────────
    const snoozed = await reminderService.snoozeReminder(testUserUuid, reminder.id, {
      snoozeType: 'MIN_10' as any,
    });
    assert(snoozed.status === ReminderStatus.SNOOZED, 'Snooze should transition status to SNOOZED');
    assert(snoozed.snoozedUntil !== null, 'SnoozedUntil timestamp must be populated');
    
    const approxDiff = snoozed.snoozedUntil!.getTime() - (Date.now() + 600000);
    assert(Math.abs(approxDiff) < 5000, 'Snoozed time should match selected snoozeType (10 minutes)');

    // ──────── Test 3: Idempotent Execution ────────
    const executionId = randomUUID();
    let triggerCount = 0;
    eventBus.subscribe('ReminderTriggered', async () => {
      triggerCount++;
    });

    // Execute first time
    await scheduler.triggerReminder(executionId, reminder.id, 'SYSTEM', 'worker-1');
    // Execute second time with same executionId (should be ignored!)
    await scheduler.triggerReminder(executionId, reminder.id, 'SYSTEM', 'worker-1');

    assert(triggerCount === 1, 'Job execution must be idempotent (exactly one trigger event emitted)');

    // ──────── Test 4: Retry Strategy & Backoff Calculations ────────
    const failingReminder = await reminderService.createReminder(testUserUuid, {
      text: 'Failing schedule',
      type: ReminderType.CUSTOM,
      triggerTime: new Date(Date.now() + 600000).toISOString(),
      retryStrategy: RetryStrategy.EXPONENTIAL,
      maxRetries: 2,
    });

    // Retry 1: simulated failure
    const execId1 = randomUUID();
    await scheduler.triggerReminder(execId1, failingReminder.id, 'SYSTEM', 'worker-1', true);
    
    let freshReminder = await reminderService.getReminderById(failingReminder.id);
    assert(freshReminder.retryCount === 1, 'Failing run should increment retry count to 1');
    assert(freshReminder.status === ReminderStatus.SNOOZED, 'Failed execution with retries left should set status to SNOOZED');

    // Verify Exponential backoff interval: 2^1 * 5 = 10 seconds from now
    const retryDelay = freshReminder.nextExecutionAt!.getTime() - Date.now();
    assert(retryDelay > 8000 && retryDelay <= 11000, 'Backoff calculation must follow selected RetryStrategy scale');

    // Retry 2: simulated failure #2 -> still within maxRetries (2) -> remains SNOOZED
    const execId2 = randomUUID();
    await scheduler.triggerReminder(execId2, failingReminder.id, 'SYSTEM', 'worker-1', true);
    freshReminder = await reminderService.getReminderById(failingReminder.id);
    assert(freshReminder.status === ReminderStatus.SNOOZED && freshReminder.retryCount === 2, 'Failed execution #2 within maxRetries remains SNOOZED');

    // Retry 3: exceeds maxRetries (2) -> dead letter (FAILED) state
    const execId3 = randomUUID();
    await scheduler.triggerReminder(execId3, failingReminder.id, 'SYSTEM', 'worker-1', true);

    freshReminder = await reminderService.getReminderById(failingReminder.id);
    assert(freshReminder.status === ReminderStatus.FAILED, 'Exceeding max retries must set status to FAILED (Dead letter state)');
    assert(freshReminder.nextExecutionAt === null, 'Dead lettered reminder must clear next execution timestamp');

    // ──────── Test 5: Todo Event Auto-Scheduling Integration ────────
    const todo = await todoService.createTodo(testUserUuid, {
      title: 'Review balance sheet',
      dueDate: new Date(Date.now() + 3600000).toISOString(), // 1 hour
    });

    // Wait a brief tick for event bus to propagate
    await new Promise(resolve => setTimeout(resolve, 500));

    const todoReminders = await reminderService.getRemindersByTarget(ReminderType.TODO, todo.id);
    assert(todoReminders.length === 1, 'Todo creation with dueDate should auto-schedule a linked Reminder');
    assert(todoReminders[0].text.includes('Review balance sheet'), 'Scheduled reminder should copy todo title');

    // Delete Todo: must cancel reminders instead of deleting history records
    await todoService.softDeleteTodo(testUserUuid, todo.id);

    await new Promise(resolve => setTimeout(resolve, 500));

    const cancelledReminder = await reminderService.getReminderById(todoReminders[0].id);
    assert(cancelledReminder.status === ReminderStatus.CANCELLED, 'Todo deletion must cancel linked reminders instead of removing them');

  } catch (error) {
    console.error('❌ Test execution encountered an unhandled error:', error);
    failed++;
  } finally {
    // Cleanup Database test entries
    await prismaAny.todoDependency.deleteMany({ where: { OR: [{ todo: { userId: testUserUuid } }, { dependsOnTodo: { userId: testUserUuid } }] } });
    await prismaAny.todoComment.deleteMany({ where: { todo: { userId: testUserUuid } } });
    await prismaAny.todoAttachment.deleteMany({ where: { todo: { userId: testUserUuid } } });
    await prismaAny.todoLabel.deleteMany({ where: { todo: { userId: testUserUuid } } });
    await prismaAny.checklist.deleteMany({ where: { todo: { userId: testUserUuid } } });
    await prismaAny.todoHistory.deleteMany({ where: { todo: { userId: testUserUuid } } });
    await prismaAny.todo.deleteMany({ where: { userId: testUserUuid } });
    await prismaAny.reminderHistory.deleteMany({ where: { reminder: { userId: testUserUuid } } });
    await prismaAny.reminderRule.deleteMany({ where: { reminder: { userId: testUserUuid } } });
    await prismaAny.reminder.deleteMany({ where: { userId: testUserUuid } });
    await prismaAny.user.deleteMany({ where: { id: testUserUuid } });

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
