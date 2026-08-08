import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { VaultItemType, FileStatus, Prisma } from '@prisma/client';

@Injectable()
export class VaultRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── User Keys ───
  async findUserKey(userId: string) {
    return this.prisma.vaultUserKey.findUnique({
      where: { userId },
    });
  }

  async createUserKey(
    userId: string,
    data: {
      wrappedKey: string;
      wrapIv: string;
      wrapAuthTag: string;
      wrappingAlgorithm: string;
      kekVersion: number;
    }
  ) {
    return this.prisma.vaultUserKey.create({
      data: {
        userId,
        ...data,
      },
    });
  }

  async updateUserKey(
    userId: string,
    data: {
      wrappedKey: string;
      wrapIv: string;
      wrapAuthTag: string;
      wrappingAlgorithm: string;
      kekVersion: number;
      rotatedAt?: Date;
    }
  ) {
    return this.prisma.vaultUserKey.update({
      where: { userId },
      data,
    });
  }

  async listAllUserKeys() {
    return this.prisma.vaultUserKey.findMany();
  }

  // ─── Folders ───
  async findFolderById(id: string, userId: string) {
    return this.prisma.vaultFolder.findFirst({
      where: { id, userId, deletedAt: null },
      include: { subFolders: { where: { deletedAt: null } } },
    });
  }

  async listFolders(userId: string) {
    return this.prisma.vaultFolder.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createFolder(userId: string, data: { name: string; parentId?: string }) {
    return this.prisma.vaultFolder.create({
      data: {
        userId,
        name: data.name,
        parentId: data.parentId || null,
        version: 1,
      },
    });
  }

  async updateFolder(
    id: string,
    userId: string,
    version: number,
    data: {
      name?: string;
      parentId?: string | null;
      deletedAt?: Date | null;
    }
  ) {
    const result = await this.prisma.vaultFolder.updateMany({
      where: { id, userId, version },
      data: {
        ...data,
        version: version + 1,
      },
    });

    if (result.count === 0) {
      // Check if it exists at all
      const exists = await this.prisma.vaultFolder.findFirst({ where: { id, userId } });
      if (!exists) throw new NotFoundException('Vault folder not found.');
      throw new ConflictException('Optimistic concurrency lock failed: Folder has been updated by another request.');
    }

    return this.prisma.vaultFolder.findFirst({ where: { id, userId } });
  }

  // ─── Vault Items (Secrets) ───
  async findItemById(id: string, userId: string) {
    return this.prisma.vaultItem.findFirst({
      where: { id, userId, deletedAt: null },
    });
  }

  async listItems(userId: string, filters: { folderId?: string; type?: VaultItemType }) {
    const where: any = { userId, deletedAt: null };
    if (filters.folderId !== undefined) where.folderId = filters.folderId;
    if (filters.type) where.type = filters.type;

    return this.prisma.vaultItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createItem(
    userId: string,
    data: {
      type: VaultItemType;
      title: string;
      ciphertext: string;
      contentIv: string;
      contentAuthTag: string;
      algorithm: string;
      encryptionVersion: string;
      dekVersion: number;
      folderId?: string;
    }
  ) {
    return this.prisma.vaultItem.create({
      data: {
        userId,
        ...data,
        version: 1,
      },
    });
  }

  async updateItem(
    id: string,
    userId: string,
    version: number,
    data: {
      title?: string;
      ciphertext?: string;
      contentIv?: string;
      contentAuthTag?: string;
      dekVersion?: number;
      folderId?: string | null;
      isFavorite?: boolean;
      isPinned?: boolean;
      deletedAt?: Date | null;
    }
  ) {
    const result = await this.prisma.vaultItem.updateMany({
      where: { id, userId, version },
      data: {
        ...data,
        version: version + 1,
      },
    });

    if (result.count === 0) {
      const exists = await this.prisma.vaultItem.findFirst({ where: { id, userId } });
      if (!exists) throw new NotFoundException('Vault item not found.');
      throw new ConflictException('Optimistic concurrency lock failed: Item has been updated by another request.');
    }

    return this.prisma.vaultItem.findFirst({ where: { id, userId } });
  }

  async listAllItemsForDEKRotation(userId: string) {
    return this.prisma.vaultItem.findMany({
      where: { userId, deletedAt: null },
    });
  }

  // ─── Vault Files ───
  async findFileById(id: string, userId: string) {
    return this.prisma.vaultFile.findFirst({
      where: { id, userId, deletedAt: null },
      include: { versions: true },
    });
  }

  async listFiles(userId: string, folderId?: string) {
    const where: any = { userId, deletedAt: null };
    if (folderId !== undefined) where.folderId = folderId;

    return this.prisma.vaultFile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFile(
    userId: string,
    data: {
      name: string;
      storagePath: string;
      fileSize: bigint;
      extension: string;
      checksum: string;
      status: FileStatus;
      mimeType?: string;
      originalFilename?: string;
      contentIv?: string;
      contentAuthTag?: string;
      dekVersion: number;
      folderId?: string;
    }
  ) {
    return this.prisma.vaultFile.create({
      data: {
        userId,
        ...data,
        version: 1,
      },
    });
  }

  async updateFile(
    id: string,
    userId: string,
    version: number,
    data: {
      status?: FileStatus;
      mimeType?: string;
      deletedAt?: Date | null;
    }
  ) {
    const result = await this.prisma.vaultFile.updateMany({
      where: { id, userId, version },
      data: {
        ...data,
        version: version + 1,
      },
    });

    if (result.count === 0) {
      const exists = await this.prisma.vaultFile.findFirst({ where: { id, userId } });
      if (!exists) throw new NotFoundException('Vault file not found.');
      throw new ConflictException('Optimistic concurrency lock failed: File has been updated by another request.');
    }

    return this.prisma.vaultFile.findFirst({ where: { id, userId } });
  }

  async listAllFilesForDEKRotation(userId: string) {
    return this.prisma.vaultFile.findMany({
      where: { userId, deletedAt: null },
      include: { versions: true },
    });
  }

  async createFileVersion(data: {
    fileId: string;
    versionVal: number;
    storagePath: string;
    fileSize: bigint;
    checksum: string;
    contentIv?: string;
    contentAuthTag?: string;
    dekVersion: number;
  }) {
    return this.prisma.vaultFileVersion.create({
      data,
    });
  }
}
