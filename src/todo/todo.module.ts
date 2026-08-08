import { Module } from '@nestjs/common';
import { TodoController } from './controllers/todo.controller';
import { TodoService } from './services/todo.service';
import { TodoRepository } from './repositories/todo.repository';
import { TodoDependencyService } from './services/todo-dependency.service';
import { TodoHistoryService } from './services/todo-history.service';
import { TodoAuditListener } from './events/todo-audit.listener';
import { TodoCommandHandler, TasksCommandHandler, TaskCommandHandler } from './telegram/todo-telegram-commands.service';
import { PrismaModule } from '../database/prisma.module';
import { CustomLogger } from '../common/logger/custom-logger.service';

@Module({
  imports: [PrismaModule],
  controllers: [TodoController],
  providers: [
    CustomLogger,
    TodoService,
    TodoRepository,
    TodoDependencyService,
    TodoHistoryService,
    TodoAuditListener,
    TodoCommandHandler,
    TasksCommandHandler,
    TaskCommandHandler,
  ],
  exports: [TodoService, TodoRepository],
})
export class TodoModule {}
