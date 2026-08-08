import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../database/prisma.service';
import { OutboxService } from '../services/outbox.service';
import { OutboxDispatcherService } from '../services/outbox-dispatcher.service';
import { EventHandlerRegistry } from '../services/event-handler-registry.service';
import { TodoService } from '../../todo/services/todo.service';
import { CalendarService } from '../../calendar/services/calendar.service';
import { SplitterService } from '../../splitter/services/splitter.service';
import { ReminderService } from '../../reminders/services/reminder.service';
import { FinanceService } from '../../finance/services/finance.service';
import { TodoCreatedEventPayload, TodoUpdatedEventPayload } from '../../todo/events/todo-events';
import { CalendarEventCreatedEventPayload } from '../../calendar/events/calendar-events';
import { SettlementCompletedEvent } from '../../splitter/events/splitter-events';
import { ReminderType, ReminderStatus, SettlementStatus, TransactionType, CalendarType, EventType, RecurrenceFrequency } from '@prisma/client';
import * as assert from 'assert';
import { randomUUID } from 'crypto';

process.env.NODE_ENV = 'test';
process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

async function runTests() {
  console.log('==================================================');
  console.log('🧪 Starting Transactional Outbox Integration Tests');
  console.log('==================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const outboxService = app.get(OutboxService);
  const outboxDispatcher = app.get(OutboxDispatcherService);
  const registry = app.get(EventHandlerRegistry);
  const todoService = app.get(TodoService);
  const calendarService = app.get(CalendarService);
  const splitterService = app.get(SplitterService);
  const reminderService = app.get(ReminderService);
  const financeService = app.get(FinanceService);

  // Stop background polling during test execution to run ticks manually
  outboxDispatcher.stop();

  const testUserUuid = '77777777-6666-5555-4444-333333333333';
  const testUserUuidB = '77777777-6666-5555-4444-444444444444';
  const groupId = randomUUID();

  let passed = 0;
  let failed = 0;

  const testAssert = (cond: boolean, msg: string) => {
    try {
      assert.ok(cond, msg);
      console.log(`✅ PASS: ${msg}`);
      passed++;
    } catch (err: any) {
      console.log(`❌ FAIL: ${msg}\n   Error: ${err.message}`);
      failed++;
    }
  };

  try {
    // ─── Setup Clean DB State ───
    await prisma.processedEvent.deleteMany({});
    await prisma.outboxEvent.deleteMany({});
    await prisma.todoHistory.deleteMany({ where: { userId: testUserUuid } });
    await prisma.todoLabel.deleteMany({});
    await prisma.todoDependency.deleteMany({});
    await prisma.todoAttachment.deleteMany({});
    await prisma.checklistItem.deleteMany({});
    await prisma.checklist.deleteMany({});
    await prisma.todo.deleteMany({ where: { userId: testUserUuid } });
    await prisma.calendarReminder.deleteMany({});
    await prisma.calendarAttendee.deleteMany({});
    await prisma.eventAttachment.deleteMany({});
    await prisma.calendarEvent.deleteMany({ where: { userId: testUserUuid } });
    await prisma.calendar.deleteMany({ where: { userId: testUserUuid } });
    await prisma.reminder.deleteMany({ where: { userId: testUserUuid } });
    await prisma.transaction.deleteMany({ where: { userId: testUserUuid } });
    await prisma.account.deleteMany({ where: { userId: testUserUuid } });
    await prisma.settlement.deleteMany({});
    await prisma.splitMember.deleteMany({ where: { userId: { in: [testUserUuid, testUserUuidB] } } });
    await prisma.splitGroup.deleteMany({ where: { id: groupId } });
    await prisma.user.deleteMany({ where: { id: { in: [testUserUuid, testUserUuidB] } } });

    await prisma.user.create({
      data: {
        id: testUserUuid,
        telegramId: 77776666n,
        firstName: 'Alice',
        lastName: 'Outbox',
        username: 'aliceoutbox',
        status: 'ACTIVE',
      }
    });

    await prisma.user.create({
      data: {
        id: testUserUuidB,
        telegramId: 66667777n,
        firstName: 'Bob',
        lastName: 'Outbox',
        username: 'boboutbox',
        status: 'ACTIVE',
      }
    });

    // ─── Test 1: Atomic Commit of mutations and outbox records ───
    const todoTitle = `Task ${randomUUID()}`;
    const todo = await todoService.createTodo(testUserUuid, {
      title: todoTitle,
      dueDate: new Date(Date.now() + 3600000).toISOString(),
    });

    const todoInDb = await prisma.todo.findUnique({ where: { id: todo.id } });
    testAssert(!!todoInDb, 'Todo created in database');

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { eventType: TodoCreatedEventPayload.eventName }
    });
    testAssert(outboxEvents.length === 1, 'TodoCreatedEvent published to OutboxEvent table');
    testAssert(outboxEvents[0].status === 'PENDING', 'OutboxEvent status is PENDING');

    // ─── Test 2: Transactional Rollback ───
    try {
      await prisma.$transaction(async (tx) => {
        // Create an invalid update that fails or throw inside
        await prisma.todo.create({
          data: {
            id: todo.id, // Duplicate ID to cause unique constraint error
            title: 'Will Rollback',
            userId: testUserUuid,
            version: 1,
          }
        });
        await outboxService.publish({
          eventName: 'WillRollbackEvent',
          payload: { text: 'never saved' },
        }, tx);
      });
    } catch (err) {
      // Expected constraint error
    }

    const rollbackEvents = await prisma.outboxEvent.findMany({
      where: { eventType: 'WillRollbackEvent' }
    });
    testAssert(rollbackEvents.length === 0, 'OutboxEvent rolled back on transaction error');

    // ─── Test 3: Concurrency Isolation (SKIP LOCKED) ───
    // Create 3 pending events
    await prisma.outboxEvent.createMany({
      data: [
        { id: randomUUID(), eventId: randomUUID(), eventType: 'ConcurrencyTest', payload: { id: 1 }, status: 'PENDING' },
        { id: randomUUID(), eventId: randomUUID(), eventType: 'ConcurrencyTest', payload: { id: 2 }, status: 'PENDING' },
        { id: randomUUID(), eventId: randomUUID(), eventType: 'ConcurrencyTest', payload: { id: 3 }, status: 'PENDING' },
      ]
    });

    // We execute two pollAndProcess ticks concurrently simulating separate workers.
    // Due to SKIP LOCKED, they should claim disjoint sets of events without blocking or duplication.
    const worker1 = outboxDispatcher.pollAndProcess();
    const worker2 = outboxDispatcher.pollAndProcess();
    await Promise.all([worker1, worker2]);

    const processingEvents = await prisma.outboxEvent.findMany({
      where: { eventType: 'ConcurrencyTest' }
    });
    testAssert(
      processingEvents.every(e => e.status === 'PROCESSED'),
      'All concurrency test events successfully claimed and processed without deadlocks or duplications'
    );

    // ─── Test 4: Idempotent Consumption (ProcessedEvent inbox pattern) ───
    const testEventId = randomUUID();
    let consumerCallCount = 0;

    registry.register('IdempotencyEvent', 'TestIdempotentConsumer', {
      handle: async (payload: any, eventName: string) => {
        consumerCallCount++;
      }
    });

    await prisma.outboxEvent.create({
      data: {
        id: randomUUID(),
        eventId: testEventId,
        eventType: 'IdempotencyEvent',
        payload: { text: 'test' },
        status: 'PENDING',
      }
    });

    // Run first time
    await outboxDispatcher.pollAndProcess();
    testAssert(consumerCallCount === 1, 'Consumer executed event for the first time');

    // Reset event to PENDING to simulate redelivery
    await prisma.outboxEvent.update({
      where: { eventId: testEventId },
      data: { status: 'PENDING' },
    });

    // Run second time
    await outboxDispatcher.pollAndProcess();
    testAssert(consumerCallCount === 1, 'Consumer skipped duplicate execution (idempotency inbox check success)');

    // ─── Test 5: Backoff Retries & Dead Letter Queue (DLQ) ───
    const testFailureEventId = randomUUID();
    registry.register('FailureEvent', 'FailingConsumer', {
      handle: async (payload: any, eventName: string) => {
        throw new Error('Database connection failed! postgresql://postgres:VAULT_CANARY_PASSWORD_12345@localhost/devmate');
      }
    });

    await prisma.outboxEvent.create({
      data: {
        id: randomUUID(),
        eventId: testFailureEventId,
        eventType: 'FailureEvent',
        payload: { text: 'fail' },
        status: 'PENDING',
        maxAttempts: 3,
      }
    });

    // Attempt 1
    await outboxDispatcher.pollAndProcess();
    let errEvent = await prisma.outboxEvent.findUnique({ where: { eventId: testFailureEventId } });
    testAssert(errEvent!.status === 'RETRY', 'Event marked RETRY on first failure');
    testAssert(errEvent!.attemptCount === 1, 'Attempt count incremented');
    testAssert(errEvent!.lastError!.includes('[REDACTED]') === true, 'Error sanitization scrubbed raw passwords');
    testAssert(errEvent!.lastError!.includes('VAULT_CANARY_PASSWORD_12345') === false, 'Raw password omitted');

    // Reset availableAt to past and run Attempt 2
    await prisma.outboxEvent.update({
      where: { eventId: testFailureEventId },
      data: { availableAt: new Date(Date.now() - 1000) }
    });
    await outboxDispatcher.pollAndProcess();

    // Reset availableAt and run Attempt 3 (hits max attempts limit of 3)
    await prisma.outboxEvent.update({
      where: { eventId: testFailureEventId },
      data: { availableAt: new Date(Date.now() - 1000) }
    });
    await outboxDispatcher.pollAndProcess();

    errEvent = await prisma.outboxEvent.findUnique({ where: { eventId: testFailureEventId } });
    testAssert(errEvent!.status === 'DEAD_LETTER', 'Event moved to DEAD_LETTER status after max attempts');
    testAssert(errEvent!.failedAt !== null, 'DLQ event records failedAt timestamp');

    // Test DLQ Admin utilities
    const deadLetters = await outboxDispatcher.listDeadLetterEvents();
    testAssert(deadLetters.length >= 1, 'DLQ admin: listDeadLetterEvents returns dead letter records');

    const metadata = await outboxDispatcher.inspectEventMetadata(errEvent!.id);
    testAssert(metadata.status === 'DEAD_LETTER' && !('payload' in metadata), 'DLQ admin: inspectEventMetadata excludes raw payload details for security');

    await outboxDispatcher.retryDeadLetterEvent(errEvent!.id);
    errEvent = await prisma.outboxEvent.findUnique({ where: { eventId: testFailureEventId } });
    testAssert(errEvent!.status === 'PENDING' && errEvent!.attemptCount === 0, 'DLQ admin: retryDeadLetterEvent resets status and attempt counts');

    // ─── Test 6: Multi-Consumer Independent Processing ───
    const testMultiEventId = randomUUID();
    const consumerState = { successRun: false };
    let failConsumerRunCount = 0;

    registry.register('MultiConsumerEvent', 'SuccessConsumer', {
      handle: async (payload: any, eventName: string) => {
        consumerState.successRun = true;
      }
    });
    registry.register('MultiConsumerEvent', 'FailConsumer', {
      handle: async (payload: any, eventName: string) => {
        failConsumerRunCount++;
        if (failConsumerRunCount === 1) {
          throw new Error('Temporary error');
        }
      }
    });

    await prisma.outboxEvent.create({
      data: {
        id: randomUUID(),
        eventId: testMultiEventId,
        eventType: 'MultiConsumerEvent',
        payload: { text: 'multi' },
        status: 'PENDING',
      }
    });

    // Run tick 1: SuccessConsumer succeeds, FailConsumer fails. Event goes to RETRY.
    await outboxDispatcher.pollAndProcess();
    let multiEvent = await prisma.outboxEvent.findUnique({ where: { eventId: testMultiEventId } });
    testAssert(multiEvent!.status === 'RETRY', 'Event marked RETRY since one consumer failed');
    testAssert(consumerState.successRun === true, 'Consumer A ran and succeeded');
    testAssert(failConsumerRunCount === 1, 'Consumer B ran and failed');

    // Reset SuccessConsumer run flag to verify it is NOT re-executed on retry
    consumerState.successRun = false;

    // Run tick 2: SuccessConsumer skipped (already in processed_events), FailConsumer succeeds. Event becomes PROCESSED.
    await prisma.outboxEvent.update({
      where: { eventId: testMultiEventId },
      data: { availableAt: new Date(Date.now() - 1000) }
    });
    await outboxDispatcher.pollAndProcess();

    multiEvent = await prisma.outboxEvent.findUnique({ where: { eventId: testMultiEventId } });
    testAssert(multiEvent!.status === 'PROCESSED', 'Event marked PROCESSED after all consumers succeeded');
    testAssert(consumerState.successRun === false, 'Success consumer skipped on retry execution (idempotency preserved)');
    testAssert(failConsumerRunCount === 2, 'Failing consumer executed again and succeeded');

    // ─── Test 7: E2E Todo → Reminder Auto-Scheduling ───
    // Run dispatcher tick to process the Todo created in Test 1
    await outboxDispatcher.pollAndProcess();

    const todoReminders = await reminderService.getRemindersByTarget(ReminderType.TODO, todo.id);
    testAssert(todoReminders.length === 1, 'Todo reminder automatically scheduled');
    testAssert(todoReminders[0].status === ReminderStatus.PENDING, 'Scheduled reminder status is PENDING');

    // ─── Test 8: E2E Calendar → Reminder Sync ───
    // Create Default Calendar for User
    const cal = await calendarService.createCalendar(testUserUuid, {
      name: 'E2E Cal',
      isDefault: true,
      timezone: 'America/New_York',
    });

    const calEvent = await calendarService.createEvent(testUserUuid, {
      calendarId: cal.id,
      title: 'E2E Outbox Event',
      startAt: new Date(Date.now() + 2 * 3600000).toISOString(),
      endAt: new Date(Date.now() + 3 * 3600000).toISOString(),
      reminders: [10, 30], // offsets
    });

    // Process event creation via Outbox
    await outboxDispatcher.pollAndProcess();

    let calReminders = await reminderService.getRemindersByTarget(ReminderType.EVENT, calEvent!.id);
    testAssert(calReminders.length === 2, 'Calendar reminders automatically provisioned via outbox event processing');

    // Cancel Calendar Event
    await calendarService.cancelEvent(testUserUuid, calEvent!.id, calEvent!.version);
    await outboxDispatcher.pollAndProcess();

    calReminders = await reminderService.getRemindersByTarget(ReminderType.EVENT, calEvent!.id);
    testAssert(
      calReminders.every(r => r.status === ReminderStatus.CANCELLED),
      'Calendar reminders successfully cancelled on Event cancellation'
    );

    // ─── Test 9: E2E Splitter → Finance Integration ───
    // Setup Split Group
    const group = await prisma.splitGroup.create({
      data: {
        id: groupId,
        name: 'Finance Test Group',
        createdBy: testUserUuid,
        status: 'ACTIVE',
      }
    });

    const mAlice = await prisma.splitMember.create({
      data: {
        groupId,
        userId: testUserUuid,
        displayName: 'Alice',
        status: 'ACTIVE',
      }
    });

    const mBob = await prisma.splitMember.create({
      data: {
        groupId,
        userId: testUserUuidB,
        displayName: 'Bob',
        status: 'ACTIVE',
      }
    });

    const settlement = await prisma.settlement.create({
      data: {
        amount: '100.0000',
        currency: 'USD',
        status: SettlementStatus.PENDING,
        syncToFinance: true,
        version: 1,
        createdBy: testUserUuid,
        group: { connect: { id: groupId } },
        payerMember: { connect: { id: mAlice.id } },
        receiverMember: { connect: { id: mBob.id } },
      }
    });

    // Complete Settlement
    await splitterService.completeSettlement(testUserUuid, groupId, settlement.id, settlement.version);
    await outboxDispatcher.pollAndProcess();

    // Verify personal transaction is created for Alice (Payer)
    const payerTx = await financeService.listTransactions(testUserUuid, { reference: settlement.id });
    testAssert(payerTx.length === 1, 'Payer outflow transaction synced to Finance module');
    testAssert(payerTx[0].type === TransactionType.EXPENSE, 'Transaction type is EXPENSE');

    // Deliver SettlementCompleted outbox event twice to test idempotency
    // We can simulate this by recreating the outbox event and running dispatcher again
    await prisma.outboxEvent.create({
      data: {
        id: randomUUID(),
        eventId: randomUUID(), // new outbox eventId
        eventType: SettlementCompletedEvent.eventName,
        payload: {
          eventId: randomUUID(),
          eventType: SettlementCompletedEvent.eventName,
          aggregateId: settlement.id,
          aggregateType: 'Settlement',
          actorId: testUserUuid,
          payload: {
            id: settlement.id,
            payerMember: { userId: testUserUuid, displayName: 'Alice' },
            receiverMember: { userId: testUserUuidB, displayName: 'Bob' },
            amount: '100.0000',
            currency: 'USD',
            syncToFinance: true,
          }
        },
        status: 'PENDING',
      }
    });

    await outboxDispatcher.pollAndProcess();

    const payerTxDouble = await financeService.listTransactions(testUserUuid, { reference: settlement.id });
    testAssert(payerTxDouble.length === 1, 'Double delivery of SettlementCompletedEvent did not create duplicate transactions (Finance settlement idempotency validated)');

  } catch (err: any) {
    console.error('💥 Unexpected test runner exception:', err);
    failed++;
  } finally {
    // Teardown DB
    console.log('\n--- Clean up Database state ---');
    await prisma.processedEvent.deleteMany({});
    await prisma.outboxEvent.deleteMany({});
    await prisma.todoHistory.deleteMany({ where: { userId: testUserUuid } });
    await prisma.todoLabel.deleteMany({});
    await prisma.todoDependency.deleteMany({});
    await prisma.todoAttachment.deleteMany({});
    await prisma.checklistItem.deleteMany({});
    await prisma.checklist.deleteMany({});
    await prisma.todo.deleteMany({ where: { userId: testUserUuid } });
    await prisma.calendarReminder.deleteMany({});
    await prisma.calendarAttendee.deleteMany({});
    await prisma.eventAttachment.deleteMany({});
    await prisma.calendarEvent.deleteMany({ where: { userId: testUserUuid } });
    await prisma.calendar.deleteMany({ where: { userId: testUserUuid } });
    await prisma.reminder.deleteMany({ where: { userId: testUserUuid } });
    await prisma.transaction.deleteMany({ where: { userId: testUserUuid } });
    await prisma.account.deleteMany({ where: { userId: testUserUuid } });
    await prisma.settlement.deleteMany({});
    await prisma.splitMember.deleteMany({ where: { userId: { in: [testUserUuid, testUserUuidB] } } });
    await prisma.splitGroup.deleteMany({ where: { id: groupId } });
    await prisma.user.deleteMany({ where: { id: { in: [testUserUuid, testUserUuidB] } } });

    await app.close();

    console.log('\n==================================================');
    console.log(`📊 Test Results: Passed: ${passed} | Failed: ${failed}`);
    console.log('==================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests().catch(err => {
  console.error('Failed to run integration tests:', err);
  process.exit(1);
});
