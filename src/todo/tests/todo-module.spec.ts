import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { validate } from 'class-validator';
import { AppModule } from '../../app.module';
import { TodoService } from '../services/todo.service';
import { TodoRepository } from '../repositories/todo.repository';
import { PrismaService } from '../../database/prisma.service';
import { IEventBus } from '../../telegram/interfaces/event-bus.interface';
import { TelegramBotProvider } from '../../telegram/bot/telegram-bot.provider';
import { CreateTodoDto } from '../dto/create-todo.dto';
import { UpdateTodoDto } from '../dto/update-todo.dto';
import { TodoCreatedEventPayload, TodoUpdatedEventPayload, TodoCompletedEventPayload } from '../events/todo-events';
import { TodoStatus, PriorityLevel } from '@prisma/client';
import { CustomLogger } from '../../common/logger/custom-logger.service';

process.env.NODE_ENV = 'test';
process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

async function runTests() {
  console.log('==================================================');
  console.log('🧪 Starting Enterprise Todo Module Integration Tests');
  console.log('==================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const todoService = app.get(TodoService);
  const todoRepository = app.get(TodoRepository);
  const eventBus = app.get(IEventBus);
  const botProvider = app.get(TelegramBotProvider);
  const logger = app.get(CustomLogger);

  logger.setContext('TodoIntegrationTests');

  // Setup Test User in DB
  const testTelegramId = 77776666n;
  const testUserUuid = '44444444-3333-2222-1111-000000000000';

  // Cleanup Database state
  const prismaAny = prisma as any;
  await prismaAny.todoDependency.deleteMany({ where: { OR: [{ todo: { userId: testUserUuid } }, { dependsOnTodo: { userId: testUserUuid } }] } });
  await prismaAny.todoComment.deleteMany({ where: { todo: { userId: testUserUuid } } });
  await prismaAny.todoAttachment.deleteMany({ where: { todo: { userId: testUserUuid } } });
  await prismaAny.todoLabel.deleteMany({ where: { todo: { userId: testUserUuid } } });
  await prismaAny.label.deleteMany({ where: { userId: testUserUuid } });
  await prismaAny.checklist.deleteMany({ where: { todo: { userId: testUserUuid } } });
  await prismaAny.todoHistory.deleteMany({ where: { todo: { userId: testUserUuid } } });
  await prismaAny.todo.deleteMany({ where: { userId: testUserUuid } });
  await prismaAny.project.deleteMany({ where: { userId: testUserUuid } });
  await prismaAny.todoList.deleteMany({ where: { userId: testUserUuid } });
  await prismaAny.user.deleteMany({ where: { id: testUserUuid } });

  // Create clean user
  await prisma.user.create({
    data: {
      id: testUserUuid,
      telegramId: testTelegramId,
      firstName: 'Bob',
      lastName: 'TodoOwner',
      username: 'bobtodo',
      status: 'ACTIVE',
    },
  });

  // Create mock Project, List, Label, VaultFile
  const project = await prismaAny.project.create({
    data: { id: '11111111-2222-3333-4444-555555555555', name: 'Work Project', userId: testUserUuid },
  });

  const todoList = await prismaAny.todoList.create({
    data: { id: '22222222-3333-4444-5555-666666666666', name: 'Personal List', userId: testUserUuid },
  });

  const label = await prismaAny.label.create({
    data: { id: '33333333-4444-5555-6666-777777777777', name: 'Important', userId: testUserUuid },
  });

  const vaultFileId = '88888888-9999-0000-1111-222222222222';
  await prismaAny.vaultFile.create({
    data: {
      id: vaultFileId,
      userId: testUserUuid,
      name: 'receipt.pdf',
      storagePath: '/uploads/receipt.pdf',
      fileSize: 2048n,
      extension: 'pdf',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      status: 'READY',
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
    // ──────── Test 1: Task Creation (CRUD) ────────
    let createdPayload: any = null;
    eventBus.subscribe(TodoCreatedEventPayload.eventName, async (payload: any) => {
      createdPayload = payload;
    });

    const createDto: CreateTodoDto = {
      title: 'Submit Expense Report',
      description: 'Monthly office expenses report.',
      priority: PriorityLevel.HIGH,
      status: TodoStatus.TODO,
      projectId: project.id,
      listId: todoList.id,
      startDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      estimatedDuration: 45, // 45 minutes
      labelIds: [label.id],
      attachmentFileIds: [vaultFileId],
      checklists: [
        {
          title: 'Review checklist',
          items: [{ title: 'Verify receipts' }, { title: 'Sign document' }],
        },
      ],
    };

    const task = await todoService.createTodo(testUserUuid, createDto);
    assert(task.title === 'Submit Expense Report', 'Should create task with correct title');
    assert(task.estimatedDuration === 45, 'Should save estimated duration in minutes');
    assert(task.labels.includes('Important'), 'Should attach project label');
    assert(task.projectName === 'Work Project', 'Should link to Work Project');
    assert(task.listName === 'Personal List', 'Should link to Personal List');
    assert(task.attachments.length === 1 && task.attachments[0].vaultFileId === vaultFileId, 'Should link to Vault File reference');
    assert(task.checklists.length === 1 && task.checklists[0].items.length === 2, 'Should normalize and create Checklist and ChecklistItems');

    // Wait for the outbox dispatcher to deliver the domain event via eventBus
    await new Promise(resolve => setTimeout(resolve, 800));

    // Event checking
    assert(createdPayload !== null, 'Should publish TodoCreated domain event');
    assert(createdPayload !== null && createdPayload.title === 'Submit Expense Report', 'Event payload should contain task title');

    // ──────── Test 2: Task Update & Optimistic Concurrency ────────
    const updated = await todoService.updateTodo(testUserUuid, task.id, {
      title: 'Submit Expense Report V2',
      version: task.version, // Correct version
    });
    assert(updated.title === 'Submit Expense Report V2', 'Should update title with correct version');
    assert(updated.version === 2, 'Should increment version number to 2');

    // Test Concurrency Lock exception
    try {
      await todoService.updateTodo(testUserUuid, task.id, {
        title: 'Submit Expense Report V3',
        version: task.version, // Old version (1 instead of 2)
      });
      assert(false, 'Should throw ConflictException on version mismatch');
    } catch (err: any) {
      assert(err.message.includes('concurrency lock'), 'Should block update and throw version conflict exception');
    }

    // ──────── Test 3: Subtask Management ────────
    const subtaskDto: CreateTodoDto = {
      title: 'Review Office Snacks Receipt',
      parentTodoId: task.id,
    };
    const subtask = await todoService.createTodo(testUserUuid, subtaskDto);
    assert(subtask.parentTodoId === task.id, 'Subtask should refer to parent task ID');

    const freshTask = await todoService.getTodoById(task.id);
    assert(freshTask.subtasks.includes(subtask.id), 'Parent task should reference child subtask ID reciprocal relation');

    // ──────── Test 4: Dependency Cycle Detection ────────
    // Create Task A and Task B
    const taskA = await todoService.createTodo(testUserUuid, { title: 'Task A' });
    const taskB = await todoService.createTodo(testUserUuid, { title: 'Task B' });

    // Link A -> B (A depends on B, meaning B blocks A)
    await todoService.updateTodo(testUserUuid, taskA.id, {
      version: taskA.version,
      dependencies: [taskB.id],
    });

    // Try to link B -> A (creates cycle B -> A -> B)
    try {
      await todoService.updateTodo(testUserUuid, taskB.id, {
        version: taskB.version,
        dependencies: [taskA.id],
      });
      assert(false, 'Should throw cycle detection circular blocker exception');
    } catch (err: any) {
      assert(err.message.includes('Circular dependency'), 'DFS cycle validation should block cycle and throw exception');
    }

    // ──────── Test 5: Soft Delete, Archive & Restore ────────
    let archived = await todoService.archiveTodo(testUserUuid, task.id);
    assert(archived.status === 'ARCHIVED' && archived.archivedAt !== null, 'Archive should set ARCHIVED status');

    const restored = await todoService.restoreTodo(testUserUuid, task.id);
    assert(restored.status === 'TODO' && restored.archivedAt === null, 'Restore should reset ARCHIVED status back to TODO');

    const softDeleted = await todoService.softDeleteTodo(testUserUuid, task.id);
    assert(softDeleted.deletedAt !== null, 'Soft delete should set deletedAt timestamp');

    // Permanent delete admin validation
    try {
      await todoService.permanentDeleteTodo(testUserUuid, task.id, ['USER']); // Non-admin role
      assert(false, 'Should block permanent delete for non-admin');
    } catch (err: any) {
      assert(err.message.includes('Only administrators'), 'Should enforce admin-only permanent delete policy');
    }

    // Admin bypasses checks
    await todoService.permanentDeleteTodo(testUserUuid, task.id, ['SUPER_ADMIN']);
    const deletedRecord = await prisma.todo.findFirst({ where: { id: task.id } });
    assert(deletedRecord === null, 'Permanent delete should hard-remove task from DB');

    // ──────── Test 6: Event-Driven Audit logs ────────
    // Wait for outbox dispatcher to process queued events (audit trail written via event-driven side-effects)
    await new Promise(resolve => setTimeout(resolve, 300));
    const auditLogs = (prismaAny.auditLog)
      ? await prismaAny.auditLog.findMany({ where: { recordId: task.id } })
      : await prisma.todoHistory.findMany({ where: { todoId: task.id } });
    assert(auditLogs.length > 0, 'Should generate event-driven audit log entries in the database');

    // ──────── Test 7: Filters & Text Search ────────
    const filterTask = await todoService.createTodo(testUserUuid, {
      title: 'Snack Shopping list item',
      priority: PriorityLevel.URGENT,
      status: TodoStatus.TODO,
    });

    const searchResult = await todoService.searchTodos(testUserUuid, {
      priority: PriorityLevel.URGENT,
      searchText: 'Snack',
    });
    assert(searchResult.items.length === 1 && searchResult.items[0].id === filterTask.id, 'Search filter should return matching priority and text');

    // ──────── Test 8: Telegram Command Handlers Integration ────────
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
        from: { id: Number(testTelegramId), is_bot: false, first_name: 'Bob', username: 'bobtodo' },
        text: '/todo Buy coffee beans',
      },
    } as any);

    assert(botReplyText.includes('created successfully') && botReplyText.includes('Buy coffee beans'), 'Telegram /todo handler should call TodoService and return confirmation message');

    bot.context.reply = originalReply;

  } catch (error) {
    console.error('❌ Test execution encountered an unhandled error:', error);
    failed++;
  } finally {
    // Cleanup Database test entries
    await prismaAny.todoDependency.deleteMany({ where: { OR: [{ todo: { userId: testUserUuid } }, { dependsOnTodo: { userId: testUserUuid } }] } });
    await prismaAny.todoComment.deleteMany({ where: { todo: { userId: testUserUuid } } });
    await prismaAny.todoAttachment.deleteMany({ where: { todo: { userId: testUserUuid } } });
    await prismaAny.todoLabel.deleteMany({ where: { todo: { userId: testUserUuid } } });
    await prismaAny.label.deleteMany({ where: { userId: testUserUuid } });
    await prismaAny.checklist.deleteMany({ where: { todo: { userId: testUserUuid } } });
    await prismaAny.todoHistory.deleteMany({ where: { todo: { userId: testUserUuid } } });
    await prismaAny.todo.deleteMany({ where: { userId: testUserUuid } });
    await prismaAny.project.deleteMany({ where: { userId: testUserUuid } });
    await prismaAny.todoList.deleteMany({ where: { userId: testUserUuid } });
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
