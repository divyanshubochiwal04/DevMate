import { Module, forwardRef } from '@nestjs/common';
import { ReminderController } from './controllers/reminder.controller';
import { ReminderService } from './services/reminder.service';
import { ReminderRepository } from './repositories/reminder.repository';
import { ReminderSchedulerService } from './scheduler/reminder-scheduler.service';
import { TodoReminderListener } from './events/todo-reminder.listener';
import { IReminderExecutor } from './interfaces/reminder-executor.interface';
import { InMemoryReminderExecutor } from './scheduler/in-memory-reminder-executor.service';
import { PrismaModule } from '../database/prisma.module';
import { TodoModule } from '../todo/todo.module';
import { CustomLogger } from '../common/logger/custom-logger.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => TodoModule), // Resolves TodoService imports for listeners
  ],
  controllers: [ReminderController],
  providers: [
    CustomLogger,
    ReminderService,
    ReminderRepository,
    ReminderSchedulerService,
    TodoReminderListener,
    {
      provide: IReminderExecutor,
      useClass: InMemoryReminderExecutor,
    },
  ],
  exports: [ReminderService, ReminderRepository],
})
export class RemindersModule {}
