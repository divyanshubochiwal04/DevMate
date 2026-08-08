import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { ReminderService } from '../services/reminder.service';
import { TodoService } from '../../todo/services/todo.service';
import { TodoCreatedEventPayload, TodoUpdatedEventPayload, TodoCompletedEventPayload, TodoDeletedEventPayload } from '../../todo/events/todo-events';
import { ReminderType, ReminderFrequency, ReminderStatus, Prisma } from '@prisma/client';
import { CustomLogger } from '../../common/logger/custom-logger.service';
import { IEventHandler } from '../../events/interfaces/event-handler.interface';
import { EventHandlerRegistry } from '../../events/services/event-handler-registry.service';

@Injectable()
export class TodoReminderListener implements OnModuleInit, IEventHandler {
  constructor(
    @Inject(forwardRef(() => ReminderService)) private readonly reminderService: ReminderService,
    @Inject(forwardRef(() => TodoService)) private readonly todoService: TodoService,
    private readonly registry: EventHandlerRegistry,
    private readonly logger: CustomLogger
  ) {
    this.logger.setContext('TodoReminderListener');
  }

  onModuleInit() {
    this.logger.log('Registering TodoReminderListener with EventHandlerRegistry...');
    this.registry.register(TodoCreatedEventPayload.eventName, 'TodoReminderConsumer', this);
    this.registry.register(TodoUpdatedEventPayload.eventName, 'TodoReminderConsumer', this);
    this.registry.register(TodoCompletedEventPayload.eventName, 'TodoReminderConsumer', this);
    this.registry.register(TodoDeletedEventPayload.eventName, 'TodoReminderConsumer', this);
  }

  async handle(payload: any, eventName: string, tx?: Prisma.TransactionClient): Promise<void> {
    
    if (eventName === TodoCreatedEventPayload.eventName) {
      const todo = await this.todoService.getTodoById(payload.todoId);
      if (todo.dueDate) {
        this.logger.log(`Auto-scheduling reminder for Todo ${todo.id} due at ${todo.dueDate}`);
        await this.reminderService.createReminder(payload.userId, {
          text: `Reminder: Task "${todo.title}" is due soon!`,
          type: ReminderType.TODO,
          targetId: todo.id,
          triggerTime: todo.dueDate.toISOString(),
          frequency: ReminderFrequency.ONETIME,
        });
      }
    } else if (eventName === TodoUpdatedEventPayload.eventName) {
      const todo = await this.todoService.getTodoById(payload.todoId);
      const reminders = await this.reminderService.getRemindersByTarget(ReminderType.TODO, todo.id);

      if (todo.dueDate) {
        if (reminders.length === 0) {
          // No reminder existed, create one
          await this.reminderService.createReminder(payload.userId, {
            text: `Reminder: Task "${todo.title}" is due soon!`,
            type: ReminderType.TODO,
            targetId: todo.id,
            triggerTime: todo.dueDate.toISOString(),
            frequency: ReminderFrequency.ONETIME,
          });
        } else {
          // Update trigger times for pending ones
          for (const rem of reminders) {
            if (rem.status === ReminderStatus.PENDING || rem.status === ReminderStatus.SCHEDULED) {
              await this.reminderService.updateReminder(payload.userId, rem.id, {
                text: `Reminder: Task "${todo.title}" is due soon!`,
                triggerTime: todo.dueDate.toISOString(),
                version: rem.version,
              });
            }
          }
        }
      } else {
        // If due date was cleared, cancel any pending reminders
        for (const rem of reminders) {
          if (rem.status === ReminderStatus.PENDING || rem.status === ReminderStatus.SCHEDULED) {
            await this.reminderService.cancelReminder(payload.userId, rem.id);
          }
        }
      }
    } else if (eventName === TodoCompletedEventPayload.eventName) {
      const reminders = await this.reminderService.getRemindersByTarget(ReminderType.TODO, payload.todoId);
      for (const rem of reminders) {
        if (rem.status === ReminderStatus.PENDING || rem.status === ReminderStatus.SCHEDULED) {
          await this.reminderService.cancelReminder(payload.userId, rem.id);
        }
      }
    } else if (eventName === TodoDeletedEventPayload.eventName) {
      const reminders = await this.reminderService.getRemindersByTarget(ReminderType.TODO, payload.todoId);
      for (const rem of reminders) {
        await this.reminderService.cancelReminder(payload.userId, rem.id);
      }
    }
  }
}
