import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NoteType, Note, NoteFolder, NoteVersion, NoteAttachment, NoteTag, NoteTagMap } from '@prisma/client';

@Injectable()
export class NotesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Folders Operations ───

  async findFolderById(id: string) {
    return this.prisma.noteFolder.findUnique({
      where: { id },
      include: { subFolders: true },
    });
  }

  async listFolders(userId: string) {
    return this.prisma.noteFolder.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { subFolders: true },
    });
  }

  async createFolder(userId: string, name: string, parentId?: string | null, sortOrder = 0) {
    // Unique name per parent folder for user
    const existing = await this.prisma.noteFolder.findFirst({
      where: { userId, parentId: parentId || null, name },
    });
    if (existing) {
      throw new BadRequestException(`Folder with name "${name}" already exists in this directory`);
    }

    return this.prisma.noteFolder.create({
      data: {
        userId,
        name,
        parentId: parentId || null,
        sortOrder,
      },
    });
  }

  async updateFolder(
    id: string,
    data: {
      name?: string;
      parentId?: string | null;
      sortOrder?: number;
    }
  ) {
    const folder = await this.prisma.noteFolder.findUnique({ where: { id } });
    if (!folder) {
      throw new BadRequestException('Folder not found');
    }

    if (data.parentId !== undefined) {
      if (data.parentId === id) {
        throw new BadRequestException('A folder cannot be its own parent');
      }
      if (data.parentId !== null) {
        const cycle = await this.checkFolderCycle(id, data.parentId);
        if (cycle) {
          throw new BadRequestException('Hierarchical cycle detected: parent folder cannot be a descendant of child folder');
        }
      }
    }

    return this.prisma.noteFolder.update({
      where: { id },
      data: {
        name: data.name,
        parentId: data.parentId === undefined ? undefined : data.parentId,
        sortOrder: data.sortOrder,
      },
    });
  }

  async deleteFolder(id: string) {
    return this.prisma.noteFolder.delete({
      where: { id },
    });
  }

  async archiveFolder(id: string, isArchived: boolean) {
    return this.prisma.noteFolder.update({
      where: { id },
      data: { isArchived },
    });
  }

  private async checkFolderCycle(folderId: string, proposedParentId: string): Promise<boolean> {
    let currentId: string | null = proposedParentId;
    while (currentId) {
      const parentFolder: { parentId: string | null } | null = await this.prisma.noteFolder.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });

      if (!parentFolder) {
        break;
      }

      if (parentFolder.parentId === folderId) {
        return true;
      }

      currentId = parentFolder.parentId;
    }
    return false;
  }

  // ─── Notes Operations ───

  async findById(id: string) {
    return this.prisma.note.findUnique({
      where: { id },
      include: {
        folder: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
        tagMaps: {
          include: { tag: true },
        },
        attachments: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
  }

  async list(
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
    sorting: { field: string; order: 'asc' | 'desc' } = { field: 'createdAt', order: 'desc' },
    pagination: { skip?: number; take?: number } = {}
  ) {
    const where: any = {
      userId,
      isTrashed: filters.isTrashed !== undefined ? filters.isTrashed : false,
    };

    if (filters.folderId !== undefined) {
      where.folderId = filters.folderId;
    }
    if (filters.isPinned !== undefined) {
      where.isPinned = filters.isPinned;
    }
    if (filters.isFavorite !== undefined) {
      where.isFavorite = filters.isFavorite;
    }
    if (filters.isArchived !== undefined) {
      where.isArchived = filters.isArchived;
    }
    if (filters.tag) {
      where.tagMaps = {
        some: {
          tag: {
            name: filters.tag.toLowerCase().trim(),
          },
        },
      };
    }
    if (filters.keyword) {
      where.OR = [
        { title: { contains: filters.keyword, mode: 'insensitive' } },
        { content: { contains: filters.keyword, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    orderBy[sorting.field] = sorting.order;

    return this.prisma.note.findMany({
      where,
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
      include: {
        folder: true,
        tagMaps: {
          include: { tag: true },
        },
        attachments: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
  }

  async create(
    userId: string,
    data: {
      title: string;
      content: string;
      type: NoteType;
      folderId?: string | null;
      wordCount: number;
      characterCount: number;
      estimatedReadingTime: number;
      createdBy?: string;
    },
    tagNames: string[] = [],
    attachments: { vaultFileId: string; displayOrder?: number; caption?: string }[] = []
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Create Note
      const note = await tx.note.create({
        data: {
          userId,
          title: data.title,
          content: data.content,
          type: data.type,
          folderId: data.folderId || null,
          wordCount: data.wordCount,
          characterCount: data.characterCount,
          estimatedReadingTime: data.estimatedReadingTime,
          createdBy: data.createdBy,
          version: 1,
        },
      });

      // 2. Map Tags
      const uniqueTagNames = Array.from(new Set(tagNames.map(t => t.toLowerCase().trim())));
      for (const name of uniqueTagNames) {
        if (!name) continue;
        // Programmatic uniqueness check
        let tag = await tx.noteTag.findFirst({
          where: { userId, name },
        });
        if (!tag) {
          tag = await tx.noteTag.create({
            data: { userId, name },
          });
        }
        await tx.noteTagMap.create({
          data: {
            noteId: note.id,
            tagId: tag.id,
            createdBy: data.createdBy,
          },
        });
      }

      // 3. Map Attachments
      for (const att of attachments) {
        await tx.noteAttachment.create({
          data: {
            noteId: note.id,
            vaultFileId: att.vaultFileId,
            displayOrder: att.displayOrder || 0,
            caption: att.caption,
          },
        });
      }

      // 4. Create Initial Note Version Snapshot
      await tx.noteVersion.create({
        data: {
          noteId: note.id,
          versionNumber: 1,
          title: data.title,
          content: data.content,
          summary: 'Initial creation',
          editedById: userId,
          createdBy: data.createdBy,
        },
      });

      return tx.note.findUnique({
        where: { id: note.id },
        include: {
          folder: true,
          versions: true,
          tagMaps: { include: { tag: true } },
          attachments: true,
        },
      });
    });
  }

  async update(
    id: string,
    currentVersion: number,
    data: {
      title?: string;
      content?: string;
      type?: NoteType;
      folderId?: string | null;
      isPinned?: boolean;
      isArchived?: boolean;
      isFavorite?: boolean;
      wordCount?: number;
      characterCount?: number;
      estimatedReadingTime?: number;
      updatedBy?: string;
    },
    tagNames?: string[],
    attachments?: { vaultFileId: string; displayOrder?: number; caption?: string }[],
    summary?: string
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Optimistic Concurrency Control Check
      // 1. Fetch original note for comparison
      const originalNote = await tx.note.findUnique({ where: { id } });
      if (!originalNote) {
        throw new BadRequestException('Note not found');
      }

      // 2. Optimistic Concurrency Control Check
      const updateResult = await tx.note.updateMany({
        where: { id, version: currentVersion },
        data: {
          ...data,
          version: currentVersion + 1,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException('Optimistic concurrency lock failed: Note was updated by another request.');
      }

      // 3. Re-map Tags if updated
      if (tagNames !== undefined) {
        await tx.noteTagMap.deleteMany({ where: { noteId: id } });
        const uniqueTagNames = Array.from(new Set(tagNames.map(t => t.toLowerCase().trim())));
        for (const name of uniqueTagNames) {
          if (!name) continue;
          let tag = await tx.noteTag.findFirst({
            where: { userId: originalNote.userId, name },
          });
          if (!tag) {
            tag = await tx.noteTag.create({
              data: { userId: originalNote.userId, name },
            });
          }
          await tx.noteTagMap.create({
            data: {
              noteId: id,
              tagId: tag.id,
              createdBy: data.updatedBy,
            },
          });
        }
      }

      // 4. Re-map Attachments if updated
      if (attachments !== undefined) {
        await tx.noteAttachment.deleteMany({ where: { noteId: id } });
        for (const att of attachments) {
          await tx.noteAttachment.create({
            data: {
              noteId: id,
              vaultFileId: att.vaultFileId,
              displayOrder: att.displayOrder || 0,
              caption: att.caption,
            },
          });
        }
      }

      // 5. Create snapshot version history if content changed
      const titleChanged = data.title !== undefined && data.title !== originalNote.title;
      const contentChanged = data.content !== undefined && data.content !== originalNote.content;

      if (titleChanged || contentChanged) {
        await tx.noteVersion.create({
          data: {
            noteId: id,
            versionNumber: currentVersion + 1,
            title: data.title ?? originalNote.title,
            content: data.content ?? originalNote.content,
            summary: summary || 'Content update',
            editedById: originalNote.userId,
            createdBy: data.updatedBy,
          },
        });
      }

      return tx.note.findUnique({
        where: { id },
        include: {
          folder: true,
          versions: { orderBy: { versionNumber: 'desc' } },
          tagMaps: { include: { tag: true } },
          attachments: true,
        },
      });
    });
  }

  async softDelete(id: string, userId: string) {
    return this.prisma.note.update({
      where: { id },
      data: {
        isTrashed: true,
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });
  }

  async restore(id: string) {
    return this.prisma.note.update({
      where: { id },
      data: {
        isTrashed: false,
        deletedAt: null,
        deletedBy: null,
      },
    });
  }

  async permanentDelete(id: string) {
    return this.prisma.note.delete({
      where: { id },
    });
  }
}
