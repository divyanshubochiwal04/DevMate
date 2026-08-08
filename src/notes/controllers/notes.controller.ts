import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { NotesService } from '../services/notes.service';
import { CreateNoteDto } from '../dto/create-note.dto';
import { UpdateNoteDto } from '../dto/update-note.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { NoteEntity, NoteFolderEntity, NoteVersionEntity } from '../entities/note.entity';

@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  // ─── Folders REST ───

  @Post('folders')
  async createFolder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { name: string; parentId?: string | null; sortOrder?: number }
  ): Promise<{ success: boolean; data: NoteFolderEntity }> {
    const data = await this.notesService.createFolder(user.id, dto.name, dto.parentId, dto.sortOrder);
    return { success: true, data };
  }

  @Get('folders')
  async listFolders(@CurrentUser() user: AuthenticatedUser): Promise<{ success: boolean; data: NoteFolderEntity[] }> {
    const data = await this.notesService.listFolders(user.id);
    return { success: true, data };
  }

  @Patch('folders/:id')
  async updateFolder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: { name?: string; parentId?: string | null; sortOrder?: number }
  ): Promise<{ success: boolean; data: NoteFolderEntity }> {
    const data = await this.notesService.updateFolder(id, dto);
    return { success: true, data };
  }

  @Delete('folders/:id')
  async deleteFolder(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.notesService.deleteFolder(id);
    return { success: true };
  }

  // ─── Notes REST ───

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateNoteDto
  ): Promise<{ success: boolean; data: NoteEntity }> {
    const data = await this.notesService.createNote(user.id, dto);
    return { success: true, data };
  }

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('folderId') folderId?: string,
    @Query('tag') tag?: string,
    @Query('isPinned') isPinned?: string,
    @Query('isFavorite') isFavorite?: string,
    @Query('isArchived') isArchived?: string,
    @Query('isTrashed') isTrashed?: string,
    @Query('keyword') keyword?: string,
    @Query('sortBy') sortBy = 'createdAt',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
    @Query('skip') skip?: string,
    @Query('take') take?: string
  ): Promise<{ success: boolean; data: NoteEntity[] }> {
    const parsedFolderId = folderId === 'null' ? null : folderId;
    const filters = {
      folderId: parsedFolderId,
      tag,
      isPinned: isPinned !== undefined ? isPinned === 'true' : undefined,
      isFavorite: isFavorite !== undefined ? isFavorite === 'true' : undefined,
      isArchived: isArchived !== undefined ? isArchived === 'true' : undefined,
      isTrashed: isTrashed !== undefined ? isTrashed === 'true' : undefined,
      keyword,
    };

    const sorting = { field: sortBy, order: sortOrder };
    const pagination = {
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    };

    const data = await this.notesService.listNotes(user.id, filters, sorting, pagination);
    return { success: true, data };
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ): Promise<{ success: boolean; data: NoteEntity }> {
    const data = await this.notesService.getNoteById(id);
    return { success: true, data };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto
  ): Promise<{ success: boolean; data: NoteEntity }> {
    const data = await this.notesService.updateNote(user.id, id, dto);
    return { success: true, data };
  }

  @Delete(':id')
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ): Promise<{ success: boolean; data: NoteEntity }> {
    const data = await this.notesService.softDeleteNote(id, user.id);
    return { success: true, data };
  }

  @Post(':id/archive')
  async archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ): Promise<{ success: boolean; data: NoteEntity }> {
    const data = await this.notesService.archiveNote(id, true);
    return { success: true, data };
  }

  @Post(':id/restore')
  async restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ): Promise<{ success: boolean; data: NoteEntity }> {
    const data = await this.notesService.restoreNote(id);
    return { success: true, data };
  }

  @Post(':id/pin')
  async pin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ): Promise<{ success: boolean; data: NoteEntity }> {
    const data = await this.notesService.pinNote(id, true);
    return { success: true, data };
  }

  @Post(':id/unpin')
  async unpin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ): Promise<{ success: boolean; data: NoteEntity }> {
    const data = await this.notesService.pinNote(id, false);
    return { success: true, data };
  }

  @Get(':id/history')
  async getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ): Promise<{ success: boolean; data: NoteVersionEntity[] }> {
    const note = await this.notesService.getNoteById(id);
    return { success: true, data: note.versions || [] };
  }
}
