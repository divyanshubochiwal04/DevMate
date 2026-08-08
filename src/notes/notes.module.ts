import { Module } from '@nestjs/common';
import { NotesController } from './controllers/notes.controller';
import { NotesService } from './services/notes.service';
import { NotesRepository } from './repositories/notes.repository';
import { NoteCommandHandler, NotesCommandHandler, FindNoteCommandHandler } from './telegram/notes-telegram-commands.service';
import { PrismaModule } from '../database/prisma.module';
import { CustomLogger } from '../common/logger/custom-logger.service';

@Module({
  imports: [PrismaModule],
  controllers: [NotesController],
  providers: [
    CustomLogger,
    NotesService,
    NotesRepository,
    NoteCommandHandler,
    NotesCommandHandler,
    FindNoteCommandHandler,
  ],
  exports: [NotesService, NotesRepository],
})
export class NotesModule {}
