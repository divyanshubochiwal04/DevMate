import { Controller, Get, Post, Patch, Delete, Param, Body, Query, ForbiddenException } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { TodoService } from '../services/todo.service';
import { CreateTodoDto } from '../dto/create-todo.dto';
import { UpdateTodoDto } from '../dto/update-todo.dto';
import { BulkCreateTodosDto, BulkUpdateStatusDto, BulkDeleteTodosDto } from '../dto/bulk-operations.dto';
import { TodoEntity, TodoCommentEntity } from '../entities/todo.entity';
import { TodoStatus, PriorityLevel } from '@prisma/client';

@Controller('todos')
export class TodoController {
  constructor(private readonly todoService: TodoService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTodoDto
  ): Promise<{ success: boolean; data: TodoEntity }> {
    const data = await this.todoService.createTodo(user.id, dto);
    return { success: true, data };
  }

  @Get()
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Query('projectId') projectId?: string,
    @Query('listId') listId?: string,
    @Query('labels') labels?: string | string[],
    @Query('ownerId') ownerId?: string,
    @Query('priority') priority?: PriorityLevel,
    @Query('status') status?: TodoStatus,
    @Query('dueToday') dueToday?: boolean,
    @Query('overdue') overdue?: boolean,
    @Query('upcoming') upcoming?: boolean,
    @Query('completed') completed?: boolean,
    @Query('archived') archived?: boolean,
    @Query('search') search?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number
  ): Promise<{ success: boolean; data: TodoEntity[]; nextCursor: string | undefined }> {
    const labelNames = typeof labels === 'string' ? [labels] : labels;

    const filters = {
      projectId,
      listId,
      labelNames,
      ownerId,
      priority,
      status,
      dueToday,
      overdue,
      upcoming,
      completed,
      archived,
      searchText: search,
    };

    const result = await this.todoService.searchTodos(user.id, filters, cursor, limit);
    return { success: true, data: result.items, nextCursor: result.nextCursor };
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ): Promise<{ success: boolean; data: TodoEntity }> {
    const data = await this.todoService.getTodoById(id);
    return { success: true, data };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTodoDto
  ): Promise<{ success: boolean; data: TodoEntity }> {
    const data = await this.todoService.updateTodo(user.id, id, dto);
    return { success: true, data };
  }

  @Delete(':id')
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('permanent') permanent?: boolean
  ): Promise<{ success: boolean; data: TodoEntity }> {
    if (permanent) {
      const data = await this.todoService.permanentDeleteTodo(user.id, id, user.roles);
      return { success: true, data };
    }
    const data = await this.todoService.softDeleteTodo(user.id, id);
    return { success: true, data };
  }

  @Post(':id/archive')
  async archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ): Promise<{ success: boolean; data: TodoEntity }> {
    const data = await this.todoService.archiveTodo(user.id, id);
    return { success: true, data };
  }

  @Post(':id/restore')
  async restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ): Promise<{ success: boolean; data: TodoEntity }> {
    const data = await this.todoService.restoreTodo(user.id, id);
    return { success: true, data };
  }

  @Post(':id/subtasks')
  async createSubtask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateTodoDto
  ): Promise<{ success: boolean; data: TodoEntity }> {
    dto.parentTodoId = id;
    const data = await this.todoService.createTodo(user.id, dto);
    return { success: true, data };
  }

  @Get(':id/subtasks')
  async getSubtasks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ): Promise<{ success: boolean; data: TodoEntity[] }> {
    const data = await this.todoService.getSubtasks(id);
    return { success: true, data };
  }

  @Post(':id/comments')
  async addComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('content') content: string
  ): Promise<{ success: boolean; data: TodoCommentEntity }> {
    const data = await this.todoService.addComment(user.id, id, content);
    return { success: true, data };
  }

  // ─── Bulk Endpoints (Split Operations) ──────────────────────────────────

  @Post('bulk/create')
  async bulkCreate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkCreateTodosDto
  ): Promise<{ success: boolean; data: TodoEntity[] }> {
    const data = await this.todoService.bulkCreateTodos(user.id, dto);
    return { success: true, data };
  }

  @Post('bulk/status')
  async bulkUpdateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkUpdateStatusDto
  ): Promise<{ success: boolean; data: TodoEntity[] }> {
    const data = await this.todoService.bulkUpdateStatus(user.id, dto);
    return { success: true, data };
  }

  @Post('bulk/delete')
  async bulkDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkDeleteTodosDto
  ): Promise<{ success: boolean; data: TodoEntity[] }> {
    const data = await this.todoService.bulkDeleteTodos(user.id, dto);
    return { success: true, data };
  }
}
