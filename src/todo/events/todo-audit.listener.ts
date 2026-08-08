import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { IEventBus } from '../../telegram/interfaces/event-bus.interface';
import { PrismaService } from '../../database/prisma.service';
import {
  TodoCreatedEventPayload,
  TodoUpdatedEventPayload,
  TodoCompletedEventPayload,
  TodoArchivedEventPayload,
  TodoDeletedEventPayload,
} from './todo-events';
import { AuditAction } from '@prisma/client';
import { loggerContextStorage } from '../../common/logger/logger-context';
import { randomUUID } from 'crypto';

@Injectable()
export class TodoAuditListener implements OnModuleInit {
  constructor(
    @Inject(IEventBus) private readonly eventBus: IEventBus,
    private readonly prisma: PrismaService
  ) {}

  onModuleInit() {
    // 1. Subscribe to TodoCreated
    this.eventBus.subscribe(TodoCreatedEventPayload.eventName, async (payload: any) => {
      await this.writeAudit(payload.userId, 'todos', payload.todoId, AuditAction.INSERT, null, {
        title: payload.title,
        priority: payload.priority,
        status: payload.status,
        createdAt: payload.createdAt,
      });
    });

    // 2. Subscribe to TodoUpdated
    this.eventBus.subscribe(TodoUpdatedEventPayload.eventName, async (payload: any) => {
      const oldVal = payload.changeDetails ? Object.keys(payload.changeDetails).reduce((acc, k) => {
        acc[k] = payload.changeDetails![k].old;
        return acc;
      }, {} as any) : null;

      const newVal = payload.changeDetails ? Object.keys(payload.changeDetails).reduce((acc, k) => {
        acc[k] = payload.changeDetails![k].new;
        return acc;
      }, {} as any) : {
        title: payload.title,
        priority: payload.priority,
        status: payload.status,
        version: payload.version,
      };

      await this.writeAudit(payload.userId, 'todos', payload.todoId, AuditAction.UPDATE, oldVal, newVal);
    });

    // 3. Subscribe to TodoCompleted
    this.eventBus.subscribe(TodoCompletedEventPayload.eventName, async (payload: any) => {
      await this.writeAudit(payload.userId, 'todos', payload.todoId, AuditAction.UPDATE, null, {
        status: 'COMPLETED',
        completedAt: payload.completedAt,
        completedById: payload.completedById,
      });
    });

    // 4. Subscribe to TodoArchived
    this.eventBus.subscribe(TodoArchivedEventPayload.eventName, async (payload: any) => {
      await this.writeAudit(payload.userId, 'todos', payload.todoId, AuditAction.UPDATE, null, {
        status: 'ARCHIVED',
        archivedAt: payload.archivedAt,
        archivedById: payload.archivedById,
      });
    });

    // 5. Subscribe to TodoDeleted
    this.eventBus.subscribe(TodoDeletedEventPayload.eventName, async (payload: any) => {
      await this.writeAudit(payload.userId, 'todos', payload.todoId, AuditAction.DELETE, null, {
        deletedAt: payload.deletedAt,
        deletedById: payload.deletedById,
      });
    });
  }

  private async writeAudit(userId: string, tableName: string, recordId: string, action: AuditAction, oldValue: any, newValue: any) {
    const store = loggerContextStorage.getStore();
    const requestId = store?.requestId || null;
    const correlationId = store?.correlationId || randomUUID();

    await this.prisma.auditLog.create({
      data: {
        userId,
        tableName,
        recordId,
        action,
        oldValue: oldValue || undefined,
        newValue: newValue || undefined,
        requestId,
        correlationId,
        version: 1,
      },
    });
  }
}
