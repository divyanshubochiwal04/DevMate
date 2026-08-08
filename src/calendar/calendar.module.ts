import { Module, forwardRef } from '@nestjs/common';
import { CalendarController } from './controllers/calendar.controller';
import { EventController } from './controllers/event.controller';
import { CalendarService } from './services/calendar.service';
import { EventRecurrenceService } from './services/event-recurrence.service';
import { EventConflictService } from './services/event-conflict.service';
import { CalendarRepository } from './repositories/calendar.repository';
import { CalendarReminderListener } from './events/calendar-reminder.listener';
import {
  CalendarListCommandHandler,
  TodayCommandHandler,
  TomorrowCommandHandler,
  EventsCommandHandler,
  EventDetailsCommandHandler,
  AddEventCommandHandler
} from './telegram/calendar-telegram-commands.service';
import { PrismaModule } from '../database/prisma.module';
import { NotesModule } from '../notes/notes.module';
import { TodoModule } from '../todo/todo.module';
import { RemindersModule } from '../reminders/reminders.module';
import { VaultModule } from '../vault/vault.module';
import { CustomLogger } from '../common/logger/custom-logger.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => NotesModule),
    forwardRef(() => TodoModule),
    forwardRef(() => RemindersModule),
    forwardRef(() => VaultModule),
  ],
  controllers: [CalendarController, EventController],
  providers: [
    CustomLogger,
    CalendarRepository,
    EventRecurrenceService,
    EventConflictService,
    CalendarService,
    CalendarReminderListener,
    CalendarListCommandHandler,
    TodayCommandHandler,
    TomorrowCommandHandler,
    EventsCommandHandler,
    EventDetailsCommandHandler,
    AddEventCommandHandler,
  ],
  exports: [CalendarService, CalendarRepository],
})
export class CalendarModule {}
