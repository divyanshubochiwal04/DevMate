import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { CalendarService } from '../services/calendar.service';
import { EventRecurrenceService } from '../services/event-recurrence.service';
import { PrismaService } from '../../database/prisma.service';
import { CalendarType, EventType, RecurrenceFrequency, AttendeeStatus, ReminderStatus, ReminderType } from '@prisma/client';
import { CustomLogger } from '../../common/logger/custom-logger.service';
import { CalendarReminderListener } from '../events/calendar-reminder.listener';
import { ReminderCompletedEventPayload } from '../../reminders/events/reminder-events';
import { IEventBus } from '../../telegram/interfaces/event-bus.interface';

process.env.NODE_ENV = 'test';
process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

async function runTests() {
  console.log('==================================================');
  console.log('🧪 Starting Enterprise Calendar Module Integration Tests');
  console.log('==================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const calendarService = app.get(CalendarService);
  const recurrenceService = app.get(EventRecurrenceService);
  const reminderListener = app.get(CalendarReminderListener);
  const logger = app.get(CustomLogger);

  logger.setContext('CalendarIntegrationTests');

  // Setup Test Users in DB
  const testTelegramId = 88889999n;
  const testUserUuid = '55555555-4444-3333-2222-111111111111';

  const testTelegramIdB = 99998888n;
  const testUserUuidB = '66666666-5555-4444-3333-222222222222';

  // Cleanup Database state
  const prismaAny = prisma as any;
  await prismaAny.calendarEvent.deleteMany({ where: { userId: { in: [testUserUuid, testUserUuidB] } } });
  await prismaAny.calendar.deleteMany({ where: { userId: { in: [testUserUuid, testUserUuidB] } } });
  await prismaAny.reminder.deleteMany({ where: { userId: { in: [testUserUuid, testUserUuidB] } } });
  await prismaAny.vaultFile.deleteMany({ where: { userId: { in: [testUserUuid, testUserUuidB] } } });
  await prismaAny.note.deleteMany({ where: { userId: { in: [testUserUuid, testUserUuidB] } } });
  await prismaAny.todo.deleteMany({ where: { userId: { in: [testUserUuid, testUserUuidB] } } });
  await prismaAny.user.deleteMany({ where: { id: { in: [testUserUuid, testUserUuidB] } } });

  // Create clean users
  await prisma.user.create({
    data: {
      id: testUserUuid,
      telegramId: testTelegramId,
      firstName: 'Alice',
      lastName: 'CalendarOwner',
      username: 'alicecalendar',
      status: 'ACTIVE',
    },
  });

  await prisma.user.create({
    data: {
      id: testUserUuidB,
      telegramId: testTelegramIdB,
      firstName: 'Bob',
      lastName: 'InquisitiveUser',
      username: 'bobinquisitive',
      status: 'ACTIVE',
    },
  });

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASSED: ${message}`);
      passed++;
    } else {
      console.log(`  ❌ FAILED: ${message}`);
      failed++;
    }
  }

  try {
    // ─── TEST CASE 1: Default Calendar Auto-Initialization ───
    console.log('\n--- Test Case 1: Default Calendar Auto-Initialization ---');
    const defCal = await calendarService.ensureDefaultCalendarExists(testUserUuid);
    assert(defCal !== null, 'Default calendar should be auto-created');
    assert(defCal.isDefault === true, 'Auto-created calendar must be default');
    assert(defCal.name === 'Personal Calendar', 'Name should be Personal Calendar');

    // ─── TEST CASE 2: Calendar CRUD ───
    console.log('\n--- Test Case 2: Calendar CRUD ---');
    const newCal = await calendarService.createCalendar(testUserUuid, {
      name: 'Work Calendar',
      type: CalendarType.WORK,
      timezone: 'America/New_York',
    });
    assert(newCal !== null, 'Work calendar created successfully');
    assert(newCal.type === CalendarType.WORK, 'Calendar type is correct');

    // Test default constraint logic
    try {
      await calendarService.createCalendar(testUserUuid, {
        name: 'Work Calendar',
        type: CalendarType.WORK,
      });
      assert(false, 'Should throw unique constraint error for duplicate name');
    } catch (err: any) {
      assert(err.message.includes('already exists'), 'Throws expected duplicate calendar error');
    }

    // ─── TEST CASE 3: DST Correctness: America/New_York Spring Forward ───
    console.log('\n--- Test Case 3: DST Correctness (America/New_York Spring Forward) ---');
    // Start date: March 1, 2026. Clocks jump forward on March 8, 2026.
    // 9:00 AM America/New_York is 14:00 UTC on March 1.
    // 9:00 AM America/New_York is 13:00 UTC on March 9.
    const startNY = recurrenceService.localToUtc(2026, 2, 1, 9, 0, 0, 'America/New_York');
    const endNY = new Date(startNY.getTime() + 60 * 60 * 1000); // 1hr event

    const nyOccurrences = recurrenceService.generateOccurrences(
      startNY,
      endNY,
      RecurrenceFrequency.DAILY,
      'America/New_York',
      new Date(Date.UTC(2026, 2, 1, 0, 0, 0)),
      new Date(Date.UTC(2026, 2, 10, 23, 59, 59)),
      {}
    );

    assert(nyOccurrences.length === 10, 'Generates exactly 10 daily occurrences');
    assert(nyOccurrences[0].startAt.toISOString() === '2026-03-01T14:00:00.000Z', 'March 1 starts at 14:00 UTC');
    assert(nyOccurrences[8].startAt.toISOString() === '2026-03-09T13:00:00.000Z', 'March 9 starts at 13:00 UTC (DST correct!)');

    // ─── TEST CASE 4: DST Correctness: America/New_York Fall Back ───
    console.log('\n--- Test Case 4: DST Correctness (America/New_York Fall Back) ---');
    // Fall back occurs on Nov 1, 2026 (EDT UTC-4 jumps back to EST UTC-5).
    // Start date: Oct 25, 2026 at 9:00 AM America/New_York (13:00 UTC).
    // Occurrence on Nov 2, 2026 at 9:00 AM America/New_York should be 14:00 UTC.
    const startNYFall = recurrenceService.localToUtc(2026, 9, 25, 9, 0, 0, 'America/New_York');
    const endNYFall = new Date(startNYFall.getTime() + 60 * 60 * 1000);

    const nyFallOccs = recurrenceService.generateOccurrences(
      startNYFall,
      endNYFall,
      RecurrenceFrequency.DAILY,
      'America/New_York',
      new Date(Date.UTC(2026, 9, 25, 0, 0, 0)),
      new Date(Date.UTC(2026, 10, 5, 23, 59, 59)),
      {}
    );

    assert(nyFallOccs[0].startAt.toISOString() === '2026-10-25T13:00:00.000Z', 'Oct 25 starts at 13:00 UTC');
    assert(nyFallOccs[8].startAt.toISOString() === '2026-11-02T14:00:00.000Z', 'Nov 2 starts at 14:00 UTC (DST fall-back correct!)');

    // ─── TEST CASE 5: DST Correctness: Asia/Kolkata Non-DST Baseline ───
    console.log('\n--- Test Case 5: DST Correctness (Asia/Kolkata Non-DST Baseline) ---');
    const startKolkata = recurrenceService.localToUtc(2026, 5, 1, 9, 0, 0, 'Asia/Kolkata');
    const endKolkata = new Date(startKolkata.getTime() + 60 * 60 * 1000);

    const kolkataOccs = recurrenceService.generateOccurrences(
      startKolkata,
      endKolkata,
      RecurrenceFrequency.DAILY,
      'Asia/Kolkata',
      new Date(Date.UTC(2026, 5, 1, 0, 0, 0)),
      new Date(Date.UTC(2026, 5, 15, 23, 59, 59)),
      {}
    );

    assert(kolkataOccs[0].startAt.toISOString() === '2026-06-01T03:30:00.000Z', 'June 1 starts at 03:30 UTC');
    assert(kolkataOccs[9].startAt.toISOString() === '2026-06-10T03:30:00.000Z', 'June 10 starts at 03:30 UTC (Kolkata baseline correct!)');

    // ─── TEST CASE 6: Timezone-aware All-Day Semantics ───
    console.log('\n--- Test Case 6: Timezone-aware All-Day Semantics ---');
    
    // NY DST Spring Forward all-day event
    const nySpringAllDay = await calendarService.createEvent(testUserUuid, {
      calendarId: newCal.id,
      title: 'NY Spring All-Day',
      startAt: '2026-03-08T00:00:00.000Z',
      endAt: '2026-03-08T00:00:00.000Z',
      isAllDay: true,
      timezone: 'America/New_York',
    });
    // March 8 jumps forward. Starts at 00:00 EST (05:00 UTC) and ends on March 9 at 00:00 EDT (04:00 UTC)
    assert(new Date(nySpringAllDay!.startAt).toISOString() === '2026-03-08T05:00:00.000Z', 'Spring all-day starts at 05:00 UTC');
    assert(new Date(nySpringAllDay!.endAt).toISOString() === '2026-03-09T04:00:00.000Z', 'Spring all-day ends at 04:00 UTC (23h duration correct!)');

    // NY DST Fall Back all-day event
    const nyFallAllDay = await calendarService.createEvent(testUserUuid, {
      calendarId: newCal.id,
      title: 'NY Fall All-Day',
      startAt: '2026-11-01T00:00:00.000Z',
      endAt: '2026-11-01T00:00:00.000Z',
      isAllDay: true,
      timezone: 'America/New_York',
    });
    // Nov 1 falls back. Starts at 00:00 EDT (04:00 UTC) and ends on Nov 2 at 00:00 EST (05:00 UTC)
    assert(new Date(nyFallAllDay!.startAt).toISOString() === '2026-11-01T04:00:00.000Z', 'Fall all-day starts at 04:00 UTC');
    assert(new Date(nyFallAllDay!.endAt).toISOString() === '2026-11-02T05:00:00.000Z', 'Fall all-day ends at 05:00 UTC (25h duration correct!)');

    // Asia/Kolkata all-day event (UTC+5:30)
    const kolkataAllDay = await calendarService.createEvent(testUserUuid, {
      calendarId: newCal.id,
      title: 'Kolkata All-Day',
      startAt: '2026-06-01T00:00:00.000Z',
      endAt: '2026-06-01T00:00:00.000Z',
      isAllDay: true,
      timezone: 'Asia/Kolkata',
    });
    assert(new Date(kolkataAllDay!.startAt).toISOString() === '2026-05-31T18:30:00.000Z', 'Kolkata all-day starts at 18:30 UTC of previous day');
    assert(new Date(kolkataAllDay!.endAt).toISOString() === '2026-06-01T18:30:00.000Z', 'Kolkata all-day ends at 18:30 UTC of next day (24h correct!)');

    // ─── TEST CASE 7: Boundary Validation Checks (External Reference Verification) ───
    console.log('\n--- Test Case 7: Boundary Validation Checks ---');
    try {
      await calendarService.createEvent(testUserUuid, {
        calendarId: newCal.id,
        title: 'Event with fake todo',
        startAt: '2026-08-04T10:00:00Z',
        endAt: '2026-08-04T11:00:00Z',
        todoId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      });
      assert(false, 'Should throw exception on missing todo ownership');
    } catch (err: any) {
      assert(err.message.includes('not found'), 'Throws expected Not Found error for fake todo ID');
    }

    // ─── TEST CASE 8: Concurrency & Optimistic Concurrency Control (OCC) ───
    console.log('\n--- Test Case 8: Concurrency & Optimistic Concurrency Control (OCC) ---');
    const evOcc = await calendarService.createEvent(testUserUuid, {
      calendarId: newCal.id,
      title: 'OCC Event',
      startAt: '2026-08-04T10:00:00Z',
      endAt: '2026-08-04T11:00:00Z',
    });

    assert(evOcc!.version === 1, 'Initial version is 1');

    try {
      await calendarService.updateEvent(testUserUuid, evOcc!.id, {
        title: 'Updated Title stale',
        version: 999, // Stale version
      });
      assert(false, 'Stale version write should fail with ConflictException');
    } catch (err: any) {
      assert(err.message.includes('Optimistic concurrency lock failed'), 'Throws ConflictException on version mismatch');
    }

    const updatedEv = await calendarService.updateEvent(testUserUuid, evOcc!.id, {
      title: 'Updated Title fresh',
      version: evOcc!.version,
    });
    assert(updatedEv!.version === 2, 'Version incremented to 2');
    assert(updatedEv!.title === 'Updated Title fresh', 'Title updated successfully');

    // ─── TEST CASE 9: Rolling Reminders Synchronization & Progression ───
    console.log('\n--- Test Case 9: Rolling Reminders Progression ---');
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    // Create a Daily Recurring Event
    const recEventRem = await calendarService.createEvent(testUserUuid, {
      calendarId: newCal.id,
      title: 'Recurring reminder event',
      startAt: tomorrow.toISOString(), // Occurrence 1 tomorrow
      endAt: new Date(tomorrow.getTime() + 30 * 60 * 1000).toISOString(),
      recurrenceFrequency: RecurrenceFrequency.DAILY,
      recurrenceCount: 3,
      reminders: [10], // 10 minutes before
    });

    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify Occurrence 1 reminder was scheduled
    let activeRems = await prisma.reminder.findMany({
      where: { targetId: recEventRem!.id, type: 'EVENT' },
    });
    assert(activeRems.length === 1, 'Exactly one reminder scheduled for next occurrence');
    const firstReminderId = activeRems[0].id;

    // Simulate completion of occurrence #1's reminder
    await prisma.reminder.update({
      where: { id: firstReminderId },
      data: { status: 'COMPLETED' },
    });

    // Fire the completed event callback inside the listener
    await app.get(IEventBus).publish(
      ReminderCompletedEventPayload.eventName,
      new ReminderCompletedEventPayload(firstReminderId, testUserUuid, new Date())
    );

    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify reminder for occurrence #2 became scheduled, and no duplicates/multiple pending exist
    activeRems = await prisma.reminder.findMany({
      where: { targetId: recEventRem!.id, type: 'EVENT' },
    });
    
    // 1 completed + 1 pending = 2 total records
    const pendingRems = activeRems.filter(r => r.status === 'PENDING' || r.status === 'SCHEDULED');
    assert(pendingRems.length === 1, 'Only one pending rolling reminder is scheduled (progression success)');
    assert(pendingRems[0].id !== firstReminderId, 'New reminder is scheduled at the next occurrence timestamp');

    // Test Reschedule
    const oldVersion = recEventRem!.version;
    const rescheduled = await calendarService.updateEvent(testUserUuid, recEventRem!.id, {
      startAt: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000).toISOString(), // Shifted 2 hours later
      version: oldVersion,
    });
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const rescheduledRems = await prisma.reminder.findMany({
      where: { targetId: recEventRem!.id, type: 'EVENT', status: 'PENDING' },
    });
    assert(rescheduledRems.length === 1, 'Rescheduling replaces the pending reminder idempotently');

    // Test Occurrence Cancellation
    const occurrenceDate = rescheduled!.startAt;
    await calendarService.cancelOccurrence(testUserUuid, recEventRem!.id, occurrenceDate);
    await new Promise(resolve => setTimeout(resolve, 300));

    const cancelledOccRems = await prisma.reminder.findMany({
      where: { targetId: recEventRem!.id, type: 'EVENT', status: 'PENDING' },
    });
    // Should rolling schedule the occurrence after the cancelled one
    assert(cancelledOccRems.length === 1, 'Occurrence cancellation syncs reminder to next active occurrence');

    // Test Deletion
    await calendarService.deleteEvent(testUserUuid, recEventRem!.id, rescheduled!.version);
    await new Promise(resolve => setTimeout(resolve, 300));
    const deletedRems = await prisma.reminder.findMany({
      where: { targetId: recEventRem!.id, type: 'EVENT', status: 'PENDING' },
    });
    assert(deletedRems.length === 0, 'Event deletion cancels all remaining rolling reminders');

    // ─── TEST CASE 10: IDOR Security Matrix ───
    console.log('\n--- Test Case 10: IDOR Security Matrix ---');
    // Alice's calendar and event
    const aliceCal = defCal;
    const aliceEvent = await calendarService.createEvent(testUserUuid, {
      calendarId: aliceCal.id,
      title: 'Alice Private Event',
      startAt: '2026-08-04T15:00:00Z',
      endAt: '2026-08-04T16:00:00Z',
    });

    // 1. User B tries to read Alice's Calendar -> must throw NotFoundException
    try {
      await calendarService.getCalendarById(testUserUuidB, aliceCal.id);
      assert(false, 'Should deny User B reading Alice calendar');
    } catch (err: any) {
      assert(err.status === 404, 'User B reading Alice calendar returns 404 NotFoundException (IDOR hide success)');
    }

    // 2. User B tries to read Alice's Event -> must throw NotFoundException
    try {
      await calendarService.getEventById(testUserUuidB, aliceEvent!.id);
      assert(false, 'Should deny User B reading Alice event');
    } catch (err: any) {
      assert(err.status === 404, 'User B reading Alice event returns 404 NotFoundException (IDOR hide success)');
    }

    // 3. User B tries to update Alice's Event -> must throw NotFoundException
    try {
      await calendarService.updateEvent(testUserUuidB, aliceEvent!.id, {
        title: 'Hacked title',
        version: aliceEvent!.version,
      });
      assert(false, 'Should deny User B updating Alice event');
    } catch (err: any) {
      assert(err.status === 404, 'User B updating Alice event returns 404 NotFoundException');
    }

    // 4. User B tries to delete Alice's Event -> must throw NotFoundException
    try {
      await calendarService.deleteEvent(testUserUuidB, aliceEvent!.id, aliceEvent!.version);
      assert(false, 'Should deny User B deleting Alice event');
    } catch (err: any) {
      assert(err.status === 404, 'User B deleting Alice event returns 404 NotFoundException');
    }

  } catch (err: any) {
    console.error('💥 Unexpected test runner exception:', err);
    failed++;
  } finally {
    // Teardown
    console.log('\n--- Clean up Database state ---');
    await prismaAny.calendarEvent.deleteMany({ where: { userId: { in: [testUserUuid, testUserUuidB] } } });
    await prismaAny.calendar.deleteMany({ where: { userId: { in: [testUserUuid, testUserUuidB] } } });
    await prismaAny.reminder.deleteMany({ where: { userId: { in: [testUserUuid, testUserUuidB] } } });
    await prismaAny.user.deleteMany({ where: { id: { in: [testUserUuid, testUserUuidB] } } });

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
