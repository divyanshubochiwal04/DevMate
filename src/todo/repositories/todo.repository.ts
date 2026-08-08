import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Todo, TodoStatus, PriorityLevel, Prisma } from '@prisma/client';

@Injectable()
export class TodoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, includeDeleted = false) {
    return this.prisma.todo.findFirst({
      where: includeDeleted ? { id } : { id, deletedAt: null },
      include: {
        project: true,
        list: true,
        parent: true,
        subtasks: { where: { deletedAt: null } },
        attachments: { include: { vaultFile: true } },
        comments: { include: { user: true } },
        checklists: { include: { items: true } },
        labels: { include: { label: true } },
        dependencies: { include: { dependsOnTodo: true } },
        dependents: { include: { todo: true } },
      },
    });
  }

  async findSubtasks(id: string) {
    return this.prisma.todo.findMany({
      where: { parentTodoId: id, deletedAt: null },
      include: {
        project: true,
        list: true,
        attachments: { include: { vaultFile: true } },
        checklists: { include: { items: true } },
        labels: { include: { label: true } },
      },
    });
  }

  async create(
    userId: string,
    data: {
      title: string;
      description?: string;
      priority?: PriorityLevel;
      status?: TodoStatus;
      projectId?: string;
      listId?: string;
      startDate?: Date;
      dueDate?: Date;
      estimatedDuration?: number;
      recurrenceRule?: string;
      parentTodoId?: string;
      createdBy?: string;
    },
    relations: {
      labelIds?: string[];
      dependencies?: string[];
      attachmentFileIds?: string[];
      checklists?: { title: string; items: { title: string; isCompleted?: boolean }[] }[];
    },
    tx?: Prisma.TransactionClient
  ) {
    const execute = async (t: Prisma.TransactionClient) => {
      const todo = await t.todo.create({
        data: {
          ...data,
          userId,
          version: 1,
        },
      });

      if (relations.labelIds && relations.labelIds.length > 0) {
        await t.todoLabel.createMany({
          data: relations.labelIds.map((labelId) => ({
            todoId: todo.id,
            labelId,
          })),
        });
      }

      if (relations.dependencies && relations.dependencies.length > 0) {
        await t.todoDependency.createMany({
          data: relations.dependencies.map((dependsOnTodoId) => ({
            todoId: todo.id,
            dependsOnTodoId,
          })),
        });
      }

      if (relations.attachmentFileIds && relations.attachmentFileIds.length > 0) {
        await t.todoAttachment.createMany({
          data: relations.attachmentFileIds.map((vaultFileId) => ({
            todoId: todo.id,
            vaultFileId,
          })),
        });
      }

      if (relations.checklists && relations.checklists.length > 0) {
        for (const cl of relations.checklists) {
          const checklist = await t.checklist.create({
            data: {
              todoId: todo.id,
              title: cl.title,
            },
          });

          if (cl.items && cl.items.length > 0) {
            await t.checklistItem.createMany({
              data: cl.items.map((item) => ({
                checklistId: checklist.id,
                title: item.title,
                isCompleted: item.isCompleted || false,
              })),
            });
          }
        }
      }

      return t.todo.findUnique({
        where: { id: todo.id },
        include: {
          project: true,
          list: true,
          parent: true,
          subtasks: true,
          attachments: { include: { vaultFile: true } },
          comments: { include: { user: true } },
          checklists: { include: { items: true } },
          labels: { include: { label: true } },
          dependencies: true,
        },
      });
    };

    return tx ? execute(tx) : this.prisma.$transaction(execute);
  }

  async update(
    id: string,
    currentVersion: number,
    data: {
      title?: string;
      description?: string;
      priority?: PriorityLevel;
      status?: TodoStatus;
      projectId?: string;
      listId?: string;
      startDate?: Date;
      dueDate?: Date;
      estimatedDuration?: number;
      actualDuration?: number;
      recurrenceRule?: string;
      parentTodoId?: string;
      updatedBy?: string;
      completedAt?: Date | null;
      completedById?: string | null;
    },
    relations: {
      labelIds?: string[];
      dependencies?: string[];
      attachmentFileIds?: string[];
      checklists?: { title: string; items: { title: string; isCompleted?: boolean }[] }[];
    },
    tx?: Prisma.TransactionClient
  ) {
    const execute = async (t: Prisma.TransactionClient) => {
      // 1. Optimistic Concurrency check
      const result = await t.todo.updateMany({
        where: { id, version: currentVersion },
        data: {
          ...data,
          version: currentVersion + 1,
        },
      });

      if (result.count === 0) {
        throw new ConflictException('Optimistic concurrency lock failed: Task has been updated by another request.');
      }

      // 2. Update labels
      if (relations.labelIds !== undefined) {
        await t.todoLabel.deleteMany({ where: { todoId: id } });
        if (relations.labelIds.length > 0) {
          await t.todoLabel.createMany({
            data: relations.labelIds.map((labelId) => ({
              todoId: id,
              labelId,
            })),
          });
        }
      }

      // 3. Update dependencies
      if (relations.dependencies !== undefined) {
        await t.todoDependency.deleteMany({ where: { todoId: id } });
        if (relations.dependencies.length > 0) {
          await t.todoDependency.createMany({
            data: relations.dependencies.map((dependsOnTodoId) => ({
              todoId: id,
              dependsOnTodoId,
            })),
          });
        }
      }

      // 4. Update attachments
      if (relations.attachmentFileIds !== undefined) {
        await t.todoAttachment.deleteMany({ where: { todoId: id } });
        if (relations.attachmentFileIds.length > 0) {
          await t.todoAttachment.createMany({
            data: relations.attachmentFileIds.map((vaultFileId) => ({
              todoId: id,
              vaultFileId,
            })),
          });
        }
      }

      // 5. Update checklists
      if (relations.checklists !== undefined) {
        // Delete old checklists
        const oldChecklists = await t.checklist.findMany({ where: { todoId: id } });
        const oldChecklistIds = oldChecklists.map((c) => c.id);
        await t.checklistItem.deleteMany({ where: { checklistId: { in: oldChecklistIds } } });
        await t.checklist.deleteMany({ where: { todoId: id } });

        for (const cl of relations.checklists) {
          const checklist = await t.checklist.create({
            data: {
              todoId: id,
              title: cl.title,
            },
          });

          if (cl.items && cl.items.length > 0) {
            await t.checklistItem.createMany({
              data: cl.items.map((item) => ({
                checklistId: checklist.id,
                title: item.title,
                isCompleted: item.isCompleted || false,
              })),
            });
          }
        }
      }

      return t.todo.findUnique({
        where: { id },
        include: {
          project: true,
          list: true,
          parent: true,
          subtasks: true,
          attachments: { include: { vaultFile: true } },
          comments: { include: { user: true } },
          checklists: { include: { items: true } },
          labels: { include: { label: true } },
          dependencies: true,
        },
      });
    };

    return tx ? execute(tx) : this.prisma.$transaction(execute);
  }

  async softDelete(id: string, deletedBy: string, tx?: Prisma.TransactionClient) {
    const client = tx || this.prisma;
    return client.todo.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
      },
    });
  }

  async permanentDelete(id: string, deletedBy: string, tx?: Prisma.TransactionClient) {
    const execute = async (t: Prisma.TransactionClient) => {
      const record = await t.todo.findUnique({ where: { id } });
      if (!record) throw new NotFoundException();
      
      // Update record with deletedBy metadata just before deleting
      await t.todo.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedBy,
        },
      });

      // Hard delete from database
      return t.todo.delete({
        where: { id },
      });
    };

    return tx ? execute(tx) : this.prisma.$transaction(execute);
  }

  async archive(id: string, archivedBy: string, tx?: Prisma.TransactionClient) {
    const client = tx || this.prisma;
    return client.todo.update({
      where: { id },
      data: {
        status: TodoStatus.ARCHIVED,
        archivedAt: new Date(),
        archivedById: archivedBy,
      },
    });
  }

  async restore(id: string, tx?: Prisma.TransactionClient) {
    const client = tx || this.prisma;
    return client.todo.update({
      where: { id },
      data: {
        status: TodoStatus.TODO,
        archivedAt: null,
        archivedById: null,
      },
    });
  }

  async addComment(todoId: string, userId: string, content: string) {
    return this.prisma.todoComment.create({
      data: {
        todoId,
        userId,
        content,
      },
      include: {
        user: true,
      },
    });
  }

  async search(
    userId: string,
    filters: {
      projectId?: string;
      listId?: string;
      labelNames?: string[];
      ownerId?: string;
      priority?: PriorityLevel;
      status?: TodoStatus;
      dueToday?: boolean;
      overdue?: boolean;
      upcoming?: boolean;
      completed?: boolean;
      archived?: boolean;
      searchText?: string;
    },
    cursor?: string,
    limit: number = 10,
    sortBy: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ) {
    const where: any = {
      userId,
      deletedAt: null,
    };

    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.listId) where.listId = filters.listId;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.priority) where.priority = filters.priority;
    
    if (filters.status) {
      where.status = filters.status;
    } else {
      if (filters.archived) {
        where.status = TodoStatus.ARCHIVED;
      } else {
        where.status = { not: TodoStatus.ARCHIVED };
      }
    }

    if (filters.dueToday) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      where.dueDate = {
        gte: startOfDay,
        lte: endOfDay,
      };
    } else if (filters.overdue) {
      where.dueDate = {
        lt: new Date(),
      };
      where.status = { notIn: [TodoStatus.COMPLETED, TodoStatus.CANCELLED, TodoStatus.ARCHIVED] };
    } else if (filters.upcoming) {
      where.dueDate = {
        gt: new Date(),
      };
      where.status = { notIn: [TodoStatus.COMPLETED, TodoStatus.CANCELLED, TodoStatus.ARCHIVED] };
    }

    if (filters.completed) {
      where.status = TodoStatus.COMPLETED;
    }

    if (filters.labelNames && filters.labelNames.length > 0) {
      where.labels = {
        some: {
          label: {
            name: { in: filters.labelNames },
          },
        },
      };
    }

    if (filters.searchText) {
      where.OR = [
        { title: { contains: filters.searchText, mode: 'insensitive' } },
        { description: { contains: filters.searchText, mode: 'insensitive' } },
      ];
    }

    const queryOptions: any = {
      where,
      take: limit + 1,
      orderBy: { [sortBy]: sortOrder },
      include: {
        project: true,
        list: true,
        parent: true,
        subtasks: true,
        attachments: { include: { vaultFile: true } },
        comments: { include: { user: true } },
        checklists: { include: { items: true } },
        labels: { include: { label: true } },
        dependencies: true,
      },
    };

    if (cursor) {
      queryOptions.cursor = { id: cursor };
      queryOptions.skip = 1;
    }

    const items = await this.prisma.todo.findMany(queryOptions);

    let nextCursor: string | undefined = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem?.id;
    }

    return {
      items,
      nextCursor,
    };
  }
}
