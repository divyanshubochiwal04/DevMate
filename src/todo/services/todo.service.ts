import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { TodoRepository } from '../repositories/todo.repository';
import { TodoDependencyService } from './todo-dependency.service';
import { TodoHistoryService } from './todo-history.service';
import { IEventBus } from '../../telegram/interfaces/event-bus.interface';
import { CreateTodoDto } from '../dto/create-todo.dto';
import { UpdateTodoDto } from '../dto/update-todo.dto';
import { BulkCreateTodosDto, BulkUpdateStatusDto, BulkDeleteTodosDto } from '../dto/bulk-operations.dto';
import { TodoEntity, TodoAttachmentEntity, TodoCommentEntity, ChecklistEntity, ChecklistItemEntity } from '../entities/todo.entity';
import {
  TodoCreatedEventPayload,
  TodoUpdatedEventPayload,
  TodoCompletedEventPayload,
  TodoArchivedEventPayload,
  TodoDeletedEventPayload,
  SubtaskCreatedEventPayload,
} from '../events/todo-events';
import { TodoStatus, PriorityLevel } from '@prisma/client';
import { CustomLogger } from '../../common/logger/custom-logger.service';
import { OutboxService } from '../../events/services/outbox.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TodoService {
  constructor(
    private readonly repository: TodoRepository,
    private readonly dependencyService: TodoDependencyService,
    private readonly historyService: TodoHistoryService,
    @Inject(IEventBus) private readonly eventBus: IEventBus,
    private readonly logger: CustomLogger,
    private readonly outboxService: OutboxService,
    private readonly prisma: PrismaService
  ) {
    this.logger.setContext('TodoService');
  }

  async getTodoById(id: string): Promise<TodoEntity> {
    const todo = await this.repository.findById(id);
    if (!todo) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    return this.mapToEntity(todo);
  }

  async getSubtasks(id: string): Promise<TodoEntity[]> {
    const subtasks = await this.repository.findSubtasks(id);
    return subtasks.map(s => this.mapToEntity(s));
  }

  async createTodo(userId: string, dto: CreateTodoDto): Promise<TodoEntity> {
    // 1. Validate start date is before due date
    if (dto.startDate && dto.dueDate) {
      if (new Date(dto.startDate) > new Date(dto.dueDate)) {
        throw new BadRequestException('Start date must be before due date');
      }
    }

    // 2. Perform database insertion
    const data = {
      title: dto.title,
      description: dto.description,
      priority: dto.priority || PriorityLevel.MEDIUM,
      status: dto.status || TodoStatus.TODO,
      projectId: dto.projectId,
      listId: dto.listId,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      estimatedDuration: dto.estimatedDuration,
      recurrenceRule: dto.recurrenceRule,
      parentTodoId: dto.parentTodoId,
      createdBy: userId,
    };

    const relations = {
      labelIds: dto.labelIds,
      dependencies: dto.dependencies,
      attachmentFileIds: dto.attachmentFileIds,
      checklists: dto.checklists,
    };

    return this.prisma.$transaction(async (tx) => {
      const todo = await this.repository.create(userId, data, relations, tx);
      const entity = this.mapToEntity(todo);

      // 3. Emit Domain Events via Outbox
      await this.outboxService.publish({
        eventName: TodoCreatedEventPayload.eventName,
        aggregateType: 'Todo',
        aggregateId: entity.id,
        userId,
        payload: new TodoCreatedEventPayload(entity.id, userId, entity.title, entity.priority, entity.status, entity.createdAt),
      }, tx);

      if (dto.parentTodoId) {
        await this.outboxService.publish({
          eventName: SubtaskCreatedEventPayload.eventName,
          aggregateType: 'Todo',
          aggregateId: entity.id,
          userId,
          payload: new SubtaskCreatedEventPayload(dto.parentTodoId, entity.id, userId, entity.title, entity.createdAt),
        }, tx);
      }

      return entity;
    });
  }

  async updateTodo(userId: string, id: string, dto: UpdateTodoDto): Promise<TodoEntity> {
    // 1. Fetch old record for history tracking, verification, and cycle check
    const oldTodo = await this.repository.findById(id);
    if (!oldTodo) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // 2. Cycle detection on dependencies update
    if (dto.dependencies && dto.dependencies.length > 0) {
      for (const depId of dto.dependencies) {
        await this.dependencyService.validateDependency(id, depId);
      }
    }

    // 3. Status completion hook
    const updateData: any = {
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      status: dto.status,
      projectId: dto.projectId,
      listId: dto.listId,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      estimatedDuration: dto.estimatedDuration,
      actualDuration: dto.actualDuration,
      recurrenceRule: dto.recurrenceRule,
      parentTodoId: dto.parentTodoId,
      updatedBy: userId,
    };

    if (dto.status === TodoStatus.COMPLETED && oldTodo.status !== TodoStatus.COMPLETED) {
      updateData.completedAt = new Date();
      updateData.completedById = userId;
    } else if (dto.status !== undefined && dto.status !== TodoStatus.COMPLETED && oldTodo.status === TodoStatus.COMPLETED) {
      updateData.completedAt = null;
      updateData.completedById = null;
    }

    const relations = {
      labelIds: dto.labelIds,
      dependencies: dto.dependencies,
      attachmentFileIds: dto.attachmentFileIds,
      checklists: dto.checklists,
    };

    return this.prisma.$transaction(async (tx) => {
      // 4. Repository update with optimistic concurrency control
      const updatedTodo = await this.repository.update(id, dto.version, updateData, relations, tx);
      const entity = this.mapToEntity(updatedTodo);

      // 5. Track state changes in separate History table
      await this.historyService.trackChanges(id, userId, oldTodo, updatedTodo!, tx);

      // 6. Emit Events via Outbox
      const changeDetails: Record<string, { old: any; new: any }> = {};
      for (const key of Object.keys(updateData)) {
        if (updateData[key] !== undefined && (oldTodo as any)[key] !== (updatedTodo as any)[key]) {
          changeDetails[key] = { old: (oldTodo as any)[key], new: (updatedTodo as any)[key] };
        }
      }

      await this.outboxService.publish({
        eventName: TodoUpdatedEventPayload.eventName,
        aggregateType: 'Todo',
        aggregateId: entity.id,
        userId,
        payload: new TodoUpdatedEventPayload(entity.id, userId, entity.title, entity.priority, entity.status, entity.version, entity.updatedAt, changeDetails),
      }, tx);

      if (dto.status === TodoStatus.COMPLETED && oldTodo.status !== TodoStatus.COMPLETED) {
        await this.outboxService.publish({
          eventName: TodoCompletedEventPayload.eventName,
          aggregateType: 'Todo',
          aggregateId: entity.id,
          userId,
          payload: new TodoCompletedEventPayload(entity.id, userId, userId, new Date()),
        }, tx);
      }

      return entity;
    });
  }

  async softDeleteTodo(userId: string, id: string): Promise<TodoEntity> {
    const todo = await this.repository.findById(id);
    if (!todo) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const deleted = await this.repository.softDelete(id, userId, tx);
      const entity = this.mapToEntity(deleted);

      await this.outboxService.publish({
        eventName: TodoDeletedEventPayload.eventName,
        aggregateType: 'Todo',
        aggregateId: entity.id,
        userId,
        payload: new TodoDeletedEventPayload(entity.id, userId, userId, new Date()),
      }, tx);

      return entity;
    });
  }

  async permanentDeleteTodo(userId: string, id: string, userRoles: string[]): Promise<TodoEntity> {
    // Enforce admin-only constraint
    if (!userRoles.includes('SUPER_ADMIN') && !userRoles.includes('ADMIN')) {
      throw new ForbiddenException('Only administrators can permanently delete tasks.');
    }

    const todo = await this.repository.findById(id, true);
    if (!todo) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    const deleted = await this.repository.permanentDelete(id, userId);
    return this.mapToEntity(deleted);
  }

  async archiveTodo(userId: string, id: string): Promise<TodoEntity> {
    const todo = await this.repository.findById(id);
    if (!todo) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const archived = await this.repository.archive(id, userId, tx);
      const entity = this.mapToEntity(archived);

      await this.outboxService.publish({
        eventName: TodoArchivedEventPayload.eventName,
        aggregateType: 'Todo',
        aggregateId: entity.id,
        userId,
        payload: new TodoArchivedEventPayload(entity.id, userId, userId, new Date()),
      }, tx);

      return entity;
    });
  }

  async restoreTodo(userId: string, id: string): Promise<TodoEntity> {
    const todo = await this.repository.findById(id, true);
    if (!todo) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    const restored = await this.repository.restore(id);
    return this.mapToEntity(restored);
  }

  async addComment(userId: string, id: string, content: string): Promise<TodoCommentEntity> {
    const todo = await this.repository.findById(id);
    if (!todo) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    const comment = await this.repository.addComment(id, userId, content);
    return new TodoCommentEntity({
      id: comment.id,
      userId: comment.userId,
      username: comment.user?.username || 'Unknown',
      content: comment.content,
      createdAt: comment.createdAt,
    });
  }

  async searchTodos(
    userId: string,
    filters: any,
    cursor?: string,
    limit?: number
  ): Promise<{ items: TodoEntity[]; nextCursor: string | undefined }> {
    const result = await this.repository.search(userId, filters, cursor, limit);
    return {
      items: result.items.map(t => this.mapToEntity(t)),
      nextCursor: result.nextCursor,
    };
  }

  // ─── Split Bulk Operations ───────────────────────────────────────────────

  async bulkCreateTodos(userId: string, dto: BulkCreateTodosDto): Promise<TodoEntity[]> {
    const results: TodoEntity[] = [];
    for (const todoDto of dto.todos) {
      const todo = await this.createTodo(userId, todoDto);
      results.push(todo);
    }
    return results;
  }

  async bulkUpdateStatus(userId: string, dto: BulkUpdateStatusDto): Promise<TodoEntity[]> {
    const results: TodoEntity[] = [];
    for (const id of dto.ids) {
      const todo = await this.repository.findById(id);
      if (todo) {
        const updated = await this.updateTodo(userId, id, {
          version: todo.version,
          status: dto.status,
        });
        results.push(updated);
      }
    }
    return results;
  }

  async bulkDeleteTodos(userId: string, dto: BulkDeleteTodosDto): Promise<TodoEntity[]> {
    const results: TodoEntity[] = [];
    for (const id of dto.ids) {
      const deleted = await this.softDeleteTodo(userId, id);
      results.push(deleted);
    }
    return results;
  }

  async validateTodoOwnership(id: string, userId: string): Promise<void> {
    const todo = await this.repository.findById(id);
    if (!todo || todo.userId !== userId) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  
  private mapToEntity(todo: any): TodoEntity {
    return new TodoEntity({
      id: todo.id,
      title: todo.title,
      description: todo.description,
      priority: todo.priority,
      status: todo.status,
      projectId: todo.projectId,
      projectName: todo.project?.name || null,
      listId: todo.listId,
      listName: todo.list?.name || null,
      startDate: todo.startDate,
      dueDate: todo.dueDate,
      completedAt: todo.completedAt,
      estimatedDuration: todo.estimatedDuration,
      actualDuration: todo.actualDuration,
      recurrenceRule: todo.recurrenceRule,
      parentTodoId: todo.parentTodoId,
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
      deletedAt: todo.deletedAt,
      createdBy: todo.createdBy,
      updatedBy: todo.updatedBy,
      completedById: todo.completedById,
      archivedById: todo.archivedById,
      archivedAt: todo.archivedAt,
      version: todo.version,
      labels: todo.labels ? todo.labels.map((l: any) => l.label.name) : [],
      subtasks: todo.subtasks ? todo.subtasks.map((s: any) => s.id) : [],
      dependencies: todo.dependencies ? todo.dependencies.map((d: any) => d.dependsOnTodoId) : [],
      attachments: todo.attachments
        ? todo.attachments.map(
            (a: any) =>
              new TodoAttachmentEntity({
                id: a.id,
                vaultFileId: a.vaultFileId,
                fileName: a.vaultFile?.name || 'Attachment',
              })
          )
        : [],
      comments: todo.comments
        ? todo.comments.map(
            (c: any) =>
              new TodoCommentEntity({
                id: c.id,
                userId: c.userId,
                username: c.user?.username || 'Unknown',
                content: c.content,
                createdAt: c.createdAt,
              })
          )
        : [],
      checklists: todo.checklists
        ? todo.checklists.map(
            (cl: any) =>
              new ChecklistEntity({
                id: cl.id,
                title: cl.title,
                items: cl.items
                  ? cl.items.map(
                      (item: any) =>
                        new ChecklistItemEntity({
                          id: item.id,
                          title: item.title,
                          isCompleted: item.isCompleted,
                        })
                    )
                  : [],
              })
          )
        : [],
    });
  }
}
