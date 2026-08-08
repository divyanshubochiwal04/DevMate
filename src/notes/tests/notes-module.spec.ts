import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { NotesService } from '../services/notes.service';
import { NotesRepository } from '../repositories/notes.repository';
import { PrismaService } from '../../database/prisma.service';
import { IEventBus } from '../../telegram/interfaces/event-bus.interface';
import { TelegramBotProvider } from '../../telegram/bot/telegram-bot.provider';
import { NoteType, FileStatus, ReminderStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

process.env.NODE_ENV = 'test';
process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

async function runTests() {
  console.log('==================================================');
  console.log('🧪 Starting Enterprise Notes Module Integration Tests');
  console.log('==================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const notesService = app.get(NotesService);
  const notesRepository = app.get(NotesRepository);
  const botProvider = app.get(TelegramBotProvider);
  const eventBus = app.get(IEventBus);

  // Setup Test User in DB
  const testUserUuid = '88888888-4444-4444-4444-888888888888';

  // Cleanup Database state
  const prismaAny = prisma as any;
  await prismaAny.noteAttachment.deleteMany({ where: { note: { userId: testUserUuid } } });
  await prismaAny.noteTagMap.deleteMany({ where: { note: { userId: testUserUuid } } });
  await prismaAny.noteTag.deleteMany({ where: { userId: testUserUuid } });
  await prismaAny.noteVersion.deleteMany({ where: { note: { userId: testUserUuid } } });
  await prismaAny.note.deleteMany({ where: { userId: testUserUuid } });
  await prismaAny.noteFolder.deleteMany({ where: { userId: testUserUuid } });
  await prismaAny.vaultFile.deleteMany({ where: { userId: testUserUuid } });
  await prismaAny.user.deleteMany({ where: { id: testUserUuid } });

  // Also clean up any leftover user with the same telegramId to prevent unique constraint violation
  await prismaAny.user.deleteMany({ where: { telegramId: 99991111n, id: { not: testUserUuid } } });

  // Create clean user
  await prisma.user.create({
    data: {
      id: testUserUuid,
      telegramId: 99991111n,
      firstName: 'Bob',
      lastName: 'NotesTester',
      username: 'bobnotes',
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
    // ──────── Test 1: CRUD & Derived Reading Metrics ────────
    const content = "Hello world! This is a simple test note containing exactly ten words here.";
    // Words count: 12 words. characterCount: 75. estimatedReadingTime: Math.ceil(12/200 * 60) = 4 seconds.
    const note = await notesService.createNote(testUserUuid, {
      title: 'DevMate Specs',
      content,
      type: NoteType.MARKDOWN,
    });

    assert(note.title === 'DevMate Specs', 'Should create note with correct title');
    assert(note.wordCount === 13, 'Should correctly calculate word count'); // 13 words (Hello, world!, This, is, a, simple, test, note, containing, exactly, ten, words, here)
    assert(note.characterCount === 74, 'Should correctly calculate character count');
    assert(note.estimatedReadingTime === 4, 'Should correctly calculate estimated reading time (4 seconds)');

    // ──────── Test 2: Tag Name Normalization ────────
    const noteWithTags = await notesService.createNote(testUserUuid, {
      title: 'Note with Tags',
      content: 'Hello tags',
      tagNames: ['  NESTED ', 'TypeScript  ', 'nested'],
    });

    assert(noteWithTags.tags!.includes('nested'), 'Tag names must be trimmed and lowercased');
    assert(noteWithTags.tags!.includes('typescript'), 'Tag names must be normalized');
    assert(noteWithTags.tags!.length === 2, 'Duplicate tags must be deduplicated in mappings');

    // ──────── Test 3: Folder Cycle Detection ────────
    const folderA = await notesService.createFolder(testUserUuid, 'Folder A');
    const folderB = await notesService.createFolder(testUserUuid, 'Folder B', folderA.id);
    const folderC = await notesService.createFolder(testUserUuid, 'Folder C', folderB.id);

    // Try to update Folder A parentId to Folder C (A -> B -> C -> A cycle)
    try {
      await notesService.updateFolder(folderA.id, { parentId: folderC.id });
      assert(false, 'Should throw BadRequestException on circular hierarchical updates');
    } catch (err: any) {
      assert(err.message.includes('cycle detected'), 'Hierarchical loop detection should reject cyclic folder paths');
    }

    // Try to make Folder A its own parent
    try {
      await notesService.updateFolder(folderA.id, { parentId: folderA.id });
      assert(false, 'Should throw BadRequestException when folder is parent of itself');
    } catch (err: any) {
      assert(err.message.includes('own parent'), 'Should reject making folder parent of itself');
    }

    // ──────── Test 4: Vault File Validation ────────
    // Create a mock Vault file in DB
    const validFileId = randomUUID();
    await prisma.vaultFile.create({
      data: {
        id: validFileId,
        userId: testUserUuid,
        name: 'design.png',
        storagePath: '/mock/design.png',
        extension: 'png',
        fileSize: 1024n,
        checksum: 'abc',
        status: FileStatus.READY,
      },
    });

    const infectedFileId = randomUUID();
    await prisma.vaultFile.create({
      data: {
        id: infectedFileId,
        userId: testUserUuid,
        name: 'infected.exe',
        storagePath: '/mock/infected.exe',
        extension: 'exe',
        fileSize: 1024n,
        checksum: 'def',
        status: FileStatus.INFECTED,
      },
    });

    // Valid attachment: succeeds
    const noteWithFiles = await notesService.createNote(testUserUuid, {
      title: 'Note with Files',
      content: 'Attachments demo',
      attachments: [{ vaultFileId: validFileId, displayOrder: 1, caption: 'Design Draft' }],
    });
    assert(noteWithFiles.attachments!.length === 1, 'Should attach valid Vault files in READY status');

    // Infected attachment: fails
    try {
      await notesService.createNote(testUserUuid, {
        title: 'Note with Infected File',
        content: 'Dangerous demo',
        attachments: [{ vaultFileId: infectedFileId }],
      });
      assert(false, 'Should fail to attach infected file');
    } catch (err: any) {
      assert(err.message.includes('not in READY status'), 'Attachment validation must reject non-READY files');
    }

    // ──────── Test 5: Optimistic Concurrency Control ────────
    const targetNote = await notesService.createNote(testUserUuid, {
      title: 'Concurrency Target',
      content: 'Initial contents',
    });

    // Success update (matching version 1)
    const firstUpdate = await notesService.updateNote(testUserUuid, targetNote.id, {
      title: 'Concurrency Winner',
      version: 1,
      summary: 'Edit 1',
    });
    assert(firstUpdate.version === 2, 'Successful write should increment note version');

    // Mismatched update (trying to write over stale version 1 instead of 2)
    try {
      await notesService.updateNote(testUserUuid, targetNote.id, {
        title: 'Concurrency Loser',
        version: 1,
        summary: 'Stale edit',
      });
      assert(false, 'Stale write must throw ConflictException');
    } catch (err: any) {
      assert(err.status === 409 || err.message.includes('concurrency'), 'Stale edits must throw 409 ConflictException');
    }

    // ──────── Test 6: Version Snapshotting & Revert ────────
    const versionedNote = await notesService.createNote(testUserUuid, {
      title: 'V1 Title',
      content: 'Content V1',
    });

    // Update to V2
    const updatedV2 = await notesService.updateNote(testUserUuid, versionedNote.id, {
      title: 'V2 Title',
      content: 'Content V2',
      version: 1,
      summary: 'Upgrade to V2',
    });
    assert(updatedV2.versions!.length === 2, 'Versions list should hold 2 historical snapshot records');

    // Restore to version 1
    const restoredV1 = await notesService.restoreVersion(versionedNote.id, 1, testUserUuid);
    assert(restoredV1.title === 'V1 Title', 'Restore action must update active title back to snapshot state');
    assert(restoredV1.content === 'Content V1', 'Restore action must update active content back to snapshot state');
    assert(restoredV1.version === 3, 'Restoring increments version to 3');

    // ──────── Test 7: Telegram Commands Integration ────────
    const bot = botProvider.getBotInstance();
    bot.botInfo = { id: 111222, is_bot: true, first_name: 'TestBot', username: 'test_bot', can_join_groups: true, can_read_all_group_messages: true, supports_inline_queries: true };

    let botReplyText = '';
    const originalReply = bot.context.reply;
    bot.context.reply = async function (text: any, extra?: any) {
      botReplyText = String(text);
      return { message_id: 1, chat: { id: 1 }, date: Date.now() } as any;
    };

    // Trigger update via bot middleware pipeline
    await bot.handleUpdate({
      update_id: 200,
      message: {
        message_id: 200,
        date: Date.now(),
        chat: { id: 111, type: 'private', first_name: 'Bob' } as any,
        from: { id: 99991111, is_bot: false, first_name: 'Bob', username: 'bobnotes' },
        text: '/note Meeting details',
      },
    } as any);

    assert(botReplyText.includes('created successfully') && botReplyText.includes('Meeting details'), 'Telegram command execution should invoke NotesService and return message');

    bot.context.reply = originalReply;

  } catch (error) {
    console.error('❌ Test execution encountered an unhandled error:', error);
    failed++;
  } finally {
    // Cleanup Database test entries
    await prismaAny.noteAttachment.deleteMany({ where: { note: { userId: testUserUuid } } });
    await prismaAny.noteTagMap.deleteMany({ where: { note: { userId: testUserUuid } } });
    await prismaAny.noteTag.deleteMany({ where: { userId: testUserUuid } });
    await prismaAny.noteVersion.deleteMany({ where: { note: { userId: testUserUuid } } });
    await prismaAny.note.deleteMany({ where: { userId: testUserUuid } });
    await prismaAny.noteFolder.deleteMany({ where: { userId: testUserUuid } });
    await prismaAny.vaultFile.deleteMany({ where: { userId: testUserUuid } });
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
