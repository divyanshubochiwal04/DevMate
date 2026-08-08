import { NoteType } from '@prisma/client';

export class NoteAttachmentEntity {
  id!: string;
  noteId!: string;
  vaultFileId!: string;
  displayOrder!: number;
  caption?: string | null;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(partial: Partial<NoteAttachmentEntity>) {
    Object.assign(this, partial);
  }
}

export class NoteVersionEntity {
  id!: string;
  noteId!: string;
  versionNumber!: number;
  title!: string;
  content!: string;
  summary?: string | null;
  editedById?: string | null;
  createdAt!: Date;

  constructor(partial: Partial<NoteVersionEntity>) {
    Object.assign(this, partial);
  }
}

export class NoteFolderEntity {
  id!: string;
  name!: string;
  userId!: string;
  parentId?: string | null;
  sortOrder!: number;
  isArchived!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(partial: Partial<NoteFolderEntity>) {
    Object.assign(this, partial);
  }
}

export class NoteEntity {
  id!: string;
  userId!: string;
  title!: string;
  content!: string;
  isPinned!: boolean;
  isArchived!: boolean;
  isTrashed!: boolean;
  isFavorite!: boolean;
  type!: NoteType;
  
  wordCount!: number;
  characterCount!: number;
  estimatedReadingTime!: number; // In seconds

  folderId?: string | null;
  folder?: NoteFolderEntity | null;

  createdAt!: Date;
  updatedAt!: Date;
  deletedAt?: Date | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  deletedBy?: string | null;
  version!: number;

  versions?: NoteVersionEntity[];
  tags?: string[];
  attachments?: NoteAttachmentEntity[];

  constructor(partial: Partial<NoteEntity>) {
    Object.assign(this, partial);
  }
}
