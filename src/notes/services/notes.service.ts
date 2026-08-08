import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { NotesRepository } from '../repositories/notes.repository';
import { IEventBus } from '../../telegram/interfaces/event-bus.interface';
import { PrismaService } from '../../database/prisma.service';
import { CreateNoteDto } from '../dto/create-note.dto';
import { UpdateNoteDto } from '../dto/update-note.dto';
import { NoteEntity, NoteFolderEntity, NoteVersionEntity, NoteAttachmentEntity } from '../entities/note.entity';
import {
  NoteCreatedEventPayload,
  NoteUpdatedEventPayload,
  NoteArchivedEventPayload,
  NoteDeletedEventPayload,
  NotePinnedEventPayload,
  NoteRestoredEventPayload,
} from '../events/note-events';
import { NoteType, FileStatus } from '@prisma/client';

@Injectable()
export class NotesService {
  constructor(
    private readonly repository: NotesRepository,
    private readonly prisma: PrismaService, // Direct lookup for Vault files without circular import dependencies
    @Inject(IEventBus) private readonly eventBus: IEventBus
  ) {}

  // ─── Folders CRUD ───

  async createFolder(userId: string, name: string, parentId?: string | null, sortOrder = 0): Promise<NoteFolderEntity> {
    const folder = await this.repository.createFolder(userId, name, parentId, sortOrder);
    return new NoteFolderEntity(folder);
  }

  async updateFolder(
    id: string,
    data: { name?: string; parentId?: string | null; sortOrder?: number }
  ): Promise<NoteFolderEntity> {
    const updated = await this.repository.updateFolder(id, data);
    return new NoteFolderEntity(updated);
  }

  async deleteFolder(id: string): Promise<void> {
    await this.repository.deleteFolder(id);
  }

  async archiveFolder(id: string, isArchived: boolean): Promise<NoteFolderEntity> {
    const folder = await this.repository.archiveFolder(id, isArchived);
    return new NoteFolderEntity(folder);
  }

  async listFolders(userId: string): Promise<NoteFolderEntity[]> {
    const folders = await this.repository.listFolders(userId);
    return folders.map(f => new NoteFolderEntity(f));
  }

  // ─── Notes CRUD ───

  async getNoteById(id: string): Promise<NoteEntity> {
    const note = await this.repository.findById(id);
    if (!note) {
      throw new NotFoundException(`Note with ID ${id} not found`);
    }
    return this.mapToEntity(note);
  }

  async listNotes(
    userId: string,
    filters: {
      folderId?: string | null;
      tag?: string;
      isPinned?: boolean;
      isFavorite?: boolean;
      isArchived?: boolean;
      isTrashed?: boolean;
      keyword?: string;
    },
    sorting?: { field: string; order: 'asc' | 'desc' },
    pagination?: { skip?: number; take?: number }
  ): Promise<NoteEntity[]> {
    const notes = await this.repository.list(userId, filters, sorting, pagination);
    return notes.map(n => this.mapToEntity(n));
  }

  async createNote(userId: string, dto: CreateNoteDto): Promise<NoteEntity> {
    // 1. Validate Vault attachments if present
    if (dto.attachments) {
      await this.validateAttachments(userId, dto.attachments);
    }

    // 2. Calculate derived metadata
    const { wordCount, characterCount, estimatedReadingTime } = this.calculateReadingMetrics(dto.content);

    // 3. Normalize Tags
    const tags = dto.tagNames ? dto.tagNames.map(t => t.toLowerCase().trim()) : [];

    const note = await this.repository.create(
      userId,
      {
        title: dto.title,
        content: dto.content,
        type: dto.type || NoteType.PLAIN,
        folderId: dto.folderId,
        wordCount,
        characterCount,
        estimatedReadingTime,
        createdBy: userId,
      },
      tags,
      dto.attachments
    );

    const entity = this.mapToEntity(note);

    // 4. Emit standard domain event
    await this.eventBus.publish(
      NoteCreatedEventPayload.eventName,
      new NoteCreatedEventPayload(entity.id, userId, entity.title, entity.createdAt)
    );

    return entity;
  }

  async updateNote(userId: string, id: string, dto: UpdateNoteDto): Promise<NoteEntity> {
    const old = await this.repository.findById(id);
    if (!old) {
      throw new NotFoundException(`Note with ID ${id} not found`);
    }

    if (dto.attachments) {
      await this.validateAttachments(userId, dto.attachments);
    }

    // Prepare update parameters
    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.content !== undefined) {
      updateData.content = dto.content;
      const { wordCount, characterCount, estimatedReadingTime } = this.calculateReadingMetrics(dto.content);
      updateData.wordCount = wordCount;
      updateData.characterCount = characterCount;
      updateData.estimatedReadingTime = estimatedReadingTime;
    }
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.folderId !== undefined) updateData.folderId = dto.folderId;

    const tags = dto.tagNames ? dto.tagNames.map(t => t.toLowerCase().trim()) : undefined;

    updateData.updatedBy = userId;

    const updated = await this.repository.update(
      id,
      dto.version,
      updateData,
      tags,
      dto.attachments,
      dto.summary
    );

    const entity = this.mapToEntity(updated);

    // Emit event
    await this.eventBus.publish(
      NoteUpdatedEventPayload.eventName,
      new NoteUpdatedEventPayload(entity.id, userId, entity.title, entity.version, entity.updatedAt)
    );

    return entity;
  }

  async softDeleteNote(id: string, userId: string): Promise<NoteEntity> {
    const note = await this.repository.findById(id);
    if (!note) {
      throw new NotFoundException(`Note with ID ${id} not found`);
    }

    const deleted = await this.repository.softDelete(id, userId);
    const entity = this.mapToEntity(deleted);

    await this.eventBus.publish(
      NoteDeletedEventPayload.eventName,
      new NoteDeletedEventPayload(id, note.userId, entity.deletedAt!)
    );

    return entity;
  }

  async restoreNote(id: string): Promise<NoteEntity> {
    const note = await this.repository.findById(id);
    if (!note) {
      throw new NotFoundException(`Note with ID ${id} not found`);
    }

    const restored = await this.repository.restore(id);
    const entity = this.mapToEntity(restored);

    await this.eventBus.publish(
      NoteRestoredEventPayload.eventName,
      new NoteRestoredEventPayload(id, note.userId, new Date())
    );

    return entity;
  }

  async archiveNote(id: string, isArchived: boolean): Promise<NoteEntity> {
    const note = await this.repository.findById(id);
    if (!note) {
      throw new NotFoundException(`Note with ID ${id} not found`);
    }

    const archived = await this.repository.update(id, note.version, { isArchived }, undefined, undefined, 'Archive state modified');
    const entity = this.mapToEntity(archived);

    await this.eventBus.publish(
      NoteArchivedEventPayload.eventName,
      new NoteArchivedEventPayload(id, note.userId, new Date())
    );

    return entity;
  }

  async pinNote(id: string, isPinned: boolean): Promise<NoteEntity> {
    const note = await this.repository.findById(id);
    if (!note) {
      throw new NotFoundException(`Note with ID ${id} not found`);
    }

    const updated = await this.repository.update(id, note.version, { isPinned }, undefined, undefined, 'Pin state modified');
    const entity = this.mapToEntity(updated);

    await this.eventBus.publish(
      NotePinnedEventPayload.eventName,
      new NotePinnedEventPayload(id, note.userId, isPinned, new Date())
    );

    return entity;
  }

  async favoriteNote(id: string, isFavorite: boolean): Promise<NoteEntity> {
    const note = await this.repository.findById(id);
    if (!note) {
      throw new NotFoundException(`Note with ID ${id} not found`);
    }

    const updated = await this.repository.update(id, note.version, { isFavorite }, undefined, undefined, 'Favorite state modified');
    return this.mapToEntity(updated);
  }

  // ─── Restore Version Architecture (Internal/Service capability only) ───

  async restoreVersion(noteId: string, versionNumber: number, userId: string): Promise<NoteEntity> {
    const note = await this.repository.findById(noteId);
    if (!note) {
      throw new NotFoundException(`Note with ID ${noteId} not found`);
    }

    const snapshot = note.versions.find(v => v.versionNumber === versionNumber);
    if (!snapshot) {
      throw new NotFoundException(`Snapshot version ${versionNumber} for note ${noteId} not found`);
    }

    // Restore note content to match version snapshot
    const restored = await this.repository.update(
      noteId,
      note.version,
      {
        title: snapshot.title,
        content: snapshot.content,
        updatedBy: userId,
      },
      undefined,
      undefined,
      `Restored to version ${versionNumber}`
    );

    const entity = this.mapToEntity(restored);

    await this.eventBus.publish(
      NoteUpdatedEventPayload.eventName,
      new NoteUpdatedEventPayload(entity.id, note.userId, entity.title, entity.version, entity.updatedAt)
    );

    return entity;
  }

  // ─── Helper calculations ───

  private calculateReadingMetrics(content: string) {
    const characterCount = content.length;
    const words = content.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    // Standard reading speed is 200 WPM. Convert WPM to seconds.
    const estimatedReadingTime = Math.ceil((wordCount / 200) * 60);

    return { wordCount, characterCount, estimatedReadingTime };
  }

  private async validateAttachments(userId: string, attachments: { vaultFileId: string }[]) {
    for (const att of attachments) {
      const file = await this.prisma.vaultFile.findUnique({
        where: { id: att.vaultFileId },
      });

      if (!file) {
        throw new BadRequestException(`Vault file with ID ${att.vaultFileId} does not exist`);
      }
      if (file.userId !== userId) {
        throw new BadRequestException(`Vault file with ID ${att.vaultFileId} is not owned by you`);
      }
      if (file.status !== FileStatus.READY) {
        throw new BadRequestException(`Vault file with ID ${att.vaultFileId} is not in READY status (current status: ${file.status})`);
      }
      if (file.deletedAt !== null) {
        throw new BadRequestException(`Vault file with ID ${att.vaultFileId} has been deleted`);
      }
    }
  }

  async validateNoteOwnership(id: string, userId: string): Promise<void> {
    const note = await this.repository.findById(id);
    if (!note || note.userId !== userId) {
      throw new NotFoundException(`Note with ID ${id} not found`);
    }
  }

  private mapToEntity(note: any): NoteEntity {
    return new NoteEntity({
      id: note.id,
      userId: note.userId,
      title: note.title,
      content: note.content,
      isPinned: note.isPinned,
      isArchived: note.isArchived,
      isTrashed: note.isTrashed,
      isFavorite: note.isFavorite,
      type: note.type,
      wordCount: note.wordCount,
      characterCount: note.characterCount,
      estimatedReadingTime: note.estimatedReadingTime,
      folderId: note.folderId,
      folder: note.folder ? new NoteFolderEntity(note.folder) : null,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      deletedAt: note.deletedAt,
      createdBy: note.createdBy,
      updatedBy: note.updatedBy,
      deletedBy: note.deletedBy,
      version: note.version,
      versions: note.versions
        ? note.versions.map(
            (v: any) =>
              new NoteVersionEntity({
                id: v.id,
                noteId: v.noteId,
                versionNumber: v.versionNumber,
                title: v.title,
                content: v.content,
                summary: v.summary,
                editedById: v.editedById,
                createdAt: v.createdAt,
              })
          )
        : [],
      tags: note.tagMaps ? note.tagMaps.map((tm: any) => tm.tag.name) : [],
      attachments: note.attachments
        ? note.attachments.map(
            (a: any) =>
              new NoteAttachmentEntity({
                id: a.id,
                noteId: a.noteId,
                vaultFileId: a.vaultFileId,
                displayOrder: a.displayOrder,
                caption: a.caption,
                createdAt: a.createdAt,
                updatedAt: a.updatedAt,
              })
          )
        : [],
    });
  }
}
