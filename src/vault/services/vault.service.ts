import { Injectable, BadRequestException, NotFoundException, Inject, ForbiddenException } from '@nestjs/common';
import { VaultRepository } from '../repositories/vault.repository';
import { IKeyManagementService } from '../interfaces/key-management.interface';
import { IVaultStorageProvider } from '../interfaces/vault-storage.interface';
import { ConfigService } from '../../config/config.service';
import * as path from 'path';
import { VaultItemType, FileStatus, Prisma, AuditAction } from '@prisma/client';
import { loggerContextStorage } from '../../common/logger/logger-context';
import * as crypto from 'crypto';
import { Buffer } from 'buffer';
import { IEventBus } from '../../telegram/interfaces/event-bus.interface';
import {
  VaultItemCreatedEvent,
  VaultItemUpdatedEvent,
  VaultItemDeletedEvent,
  VaultItemRestoredEvent,
  VaultFileUploadedEvent,
  VaultFileDeletedEvent,
  VaultKeyRotatedEvent,
} from '../events/vault-events';
import { CustomLogger } from '../../common/logger/custom-logger.service';

@Injectable()
export class VaultService {
  private readonly algorithm = 'aes-256-gcm';

  constructor(
    private readonly repository: VaultRepository,
    @Inject(IKeyManagementService) private readonly kms: IKeyManagementService,
    @Inject(IVaultStorageProvider) private readonly storage: IVaultStorageProvider,
    private readonly configService: ConfigService,
    @Inject(IEventBus) private readonly eventBus: IEventBus,
    private readonly logger: CustomLogger
  ) {
    this.logger.setContext('VaultService');
  }

  // ─── Cryptographic Helpers ───

  private getMasterKeyBuffer(): Buffer {
    const keyStr = this.configService.vaultMasterKey;
    if (!keyStr) {
      throw new Error('Vault Master Key (KEK) is not configured.');
    }
    return Buffer.from(keyStr, 'base64');
  }

  /**
   * Decrypts the user's wrapped DEK from DB using the Master Key.
   * Generates a new wrapped DEK if it does not exist yet.
   */
  async getOrCreateUserDEK(userId: string): Promise<Buffer> {
    const userKey = await this.repository.findUserKey(userId);
    const kek = this.getMasterKeyBuffer();

    if (!userKey) {
      this.logger.log(`Initializing cryptographically secure DEK envelope for user ${userId}`);
      const rawDek = await this.kms.generateDataKey();
      const wrapped = await this.kms.wrapKey(rawDek, kek, 1);

      await this.repository.createUserKey(userId, {
        wrappedKey: wrapped.wrappedKey,
        wrapIv: wrapped.wrapIv,
        wrapAuthTag: wrapped.wrapAuthTag,
        wrappingAlgorithm: wrapped.wrappingAlgorithm,
        kekVersion: wrapped.kekVersion,
      });

      return rawDek;
    }

    // Unwrap the existing DEK
    return this.kms.unwrapKey(
      userKey.wrappedKey,
      userKey.wrapIv,
      userKey.wrapAuthTag,
      kek
    );
  }

  /**
   * Encrypts plaintext data using the user's DEK.
   */
  async encryptPayload(userId: string, plaintext: string): Promise<{ ciphertext: string; iv: string; authTag: string }> {
    const dek = await this.getOrCreateUserDEK(userId);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, dek, iv);

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  /**
   * Decrypts ciphertext data using the user's DEK.
   */
  async decryptPayload(userId: string, ciphertext: string, iv: string, authTag: string): Promise<string> {
    const dek = await this.getOrCreateUserDEK(userId);
    try {
      const ivBuffer = Buffer.from(iv, 'base64');
      const tagBuffer = Buffer.from(authTag, 'base64');
      const encryptedBuffer = Buffer.from(ciphertext, 'base64');

      const decipher = crypto.createDecipheriv(this.algorithm, dek, ivBuffer);
      decipher.setAuthTag(tagBuffer);

      return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]).toString('utf8');
    } catch (err: any) {
      throw new BadRequestException('Failed to decrypt payload. Ciphertext integrity verification failed (tampered data).');
    }
  }

  // ─── Folders ───

  async createFolder(userId: string, data: { name: string; parentId?: string; sortOrder?: number }) {
    if (data.parentId) {
      const parent = await this.repository.findFolderById(data.parentId, userId);
      if (!parent) throw new NotFoundException('Parent folder not found.');
    }
    return this.repository.createFolder(userId, data);
  }

  async getFolder(userId: string, id: string) {
    const folder = await this.repository.findFolderById(id, userId);
    if (!folder) throw new NotFoundException(`Folder ${id} not found.`);
    return folder;
  }

  async listFolders(userId: string) {
    return this.repository.listFolders(userId);
  }

  async updateFolder(
    userId: string,
    id: string,
    version: number,
    data: { name?: string; parentId?: string | null; sortOrder?: number }
  ) {
    // Verify folder existence
    const folder = await this.getFolder(userId, id);

    // Cycle detection
    if (data.parentId) {
      await this.detectCycle(id, data.parentId, userId);
      const parent = await this.repository.findFolderById(data.parentId, userId);
      if (!parent) throw new NotFoundException('Parent folder not found.');
    }

    return this.repository.updateFolder(id, userId, version, data);
  }

  async deleteFolder(userId: string, id: string, version: number) {
    await this.getFolder(userId, id);
    // Soft delete folder
    return this.repository.updateFolder(id, userId, version, { deletedAt: new Date() });
  }

  private async detectCycle(folderId: string, parentId: string, userId: string): Promise<void> {
    let currentParentId: string | null = parentId;
    const visited = new Set<string>();

    while (currentParentId) {
      if (currentParentId === folderId) {
        throw new BadRequestException('Folder hierarchy cycle detected (A -> B -> C -> A).');
      }
      if (visited.has(currentParentId)) {
        break; // Guard against existing db cycles
      }
      visited.add(currentParentId);

      const parentFolder = await this.repository.findFolderById(currentParentId, userId);
      currentParentId = parentFolder ? parentFolder.parentId : null;
    }
  }

  // ─── Vault Items (Secrets) ───

  async createItem(
    userId: string,
    dto: {
      type: VaultItemType;
      title: string;
      folderId?: string;
      payload: any; // Structured payload
    }
  ) {
    if (dto.folderId) {
      const folder = await this.repository.findFolderById(dto.folderId, userId);
      if (!folder) throw new NotFoundException('Folder not found.');
    }

    const plaintext = JSON.stringify(dto.payload);
    const encrypted = await this.encryptPayload(userId, plaintext);

    const userKey = await this.repository.findUserKey(userId);
    const dekVersion = userKey ? userKey.kekVersion : 1;

    const item = await this.repository.createItem(userId, {
      type: dto.type,
      title: dto.title,
      ciphertext: encrypted.ciphertext,
      contentIv: encrypted.iv,
      contentAuthTag: encrypted.authTag,
      algorithm: this.algorithm,
      encryptionVersion: 'v1',
      dekVersion,
      folderId: dto.folderId,
    });

    await this.eventBus.publish(
      VaultItemCreatedEvent.eventName,
      new VaultItemCreatedEvent(item.id, userId, { type: item.type, title: item.title })
    );

    return item;
  }

  async updateItem(
    userId: string,
    id: string,
    version: number,
    dto: {
      title?: string;
      folderId?: string | null;
      payload?: any;
      isFavorite?: boolean;
      isPinned?: boolean;
    }
  ) {
    const item = await this.repository.findItemById(id, userId);
    if (!item) throw new NotFoundException('Vault item not found.');

    if (dto.folderId) {
      const folder = await this.repository.findFolderById(dto.folderId, userId);
      if (!folder) throw new NotFoundException('Folder not found.');
    }

    const updateData: any = {
      title: dto.title,
      folderId: dto.folderId,
      isFavorite: dto.isFavorite,
      isPinned: dto.isPinned,
    };

    if (dto.payload) {
      const plaintext = JSON.stringify(dto.payload);
      const encrypted = await this.encryptPayload(userId, plaintext);
      const userKey = await this.repository.findUserKey(userId);
      
      updateData.ciphertext = encrypted.ciphertext;
      updateData.contentIv = encrypted.iv;
      updateData.contentAuthTag = encrypted.authTag;
      updateData.dekVersion = userKey ? userKey.kekVersion : 1;
    }

    const updated = await this.repository.updateItem(id, userId, version, updateData);

    await this.eventBus.publish(
      VaultItemUpdatedEvent.eventName,
      new VaultItemUpdatedEvent(id, userId, { title: updated?.title })
    );

    return updated;
  }

  async listItems(userId: string, filters: { folderId?: string; type?: VaultItemType }) {
    return this.repository.listItems(userId, filters);
  }

  async getItemMetadata(userId: string, id: string) {
    const item = await this.repository.findItemById(id, userId);
    if (!item) throw new NotFoundException('Vault item not found.');
    return item;
  }

  /**
   * Decrypts and returns the sensitive secret payload.
   * Scoped strictly by userId.
   */
  async revealItem(userId: string, id: string): Promise<any> {
    const item = await this.repository.findItemById(id, userId);
    if (!item) throw new NotFoundException('Vault item not found.');

    // Guarantee synchronous audit log write before revealing the secret
    await this.writeAuditSync(userId, 'vault_items', id, AuditAction.SECURITY_FLAG, null, {
      action: 'REVEAL_SECRET',
      type: item.type,
      title: item.title,
    });

    const plaintext = await this.decryptPayload(userId, item.ciphertext, item.contentIv, item.contentAuthTag);
    return JSON.parse(plaintext);
  }

  async deleteItem(userId: string, id: string, version: number) {
    const item = await this.repository.findItemById(id, userId);
    if (!item) throw new NotFoundException('Vault item not found.');

    const deleted = await this.repository.updateItem(id, userId, version, { deletedAt: new Date() });

    await this.eventBus.publish(
      VaultItemDeletedEvent.eventName,
      new VaultItemDeletedEvent(id, userId)
    );

    return deleted;
  }

  async restoreItem(userId: string, id: string, version: number) {
    // We must find soft-deleted items too
    const item = await this.prisma.vaultItem.findFirst({
      where: { id, userId, deletedAt: { not: null } },
    });
    if (!item) throw new NotFoundException('Soft-deleted Vault item not found.');

    const restored = await this.repository.updateItem(id, userId, version, { deletedAt: null });

    await this.eventBus.publish(
      VaultItemRestoredEvent.eventName,
      new VaultItemRestoredEvent(id, userId)
    );

    return restored;
  }

  // ─── Vault Files ───

  async listFiles(userId: string, folderId?: string) {
    return this.repository.listFiles(userId, folderId);
  }

  async getFileMetadata(userId: string, id: string) {
    const file = await this.repository.findFileById(id, userId);
    if (!file) throw new NotFoundException('Vault file not found.');
    return file;
  }

  /**
   * Safe upload and GCM encryption block.
   */
  async uploadFile(
    userId: string,
    file: {
      originalname: string;
      mimetype: string;
      buffer: Buffer;
      size: number;
    },
    folderId?: string
  ) {
    // 1. DTO/Config boundaries checks
    const maxSize = this.configService.vaultMaxFileSize;
    if (file.size > maxSize) {
      throw new BadRequestException(`File size exceeds maximum allowed boundary of ${maxSize} bytes.`);
    }

    // 2. MIME signature checking — magic bytes are authoritative; extension mismatch is rejected.
    const { detectedMime, spoofDetected, spoofReason } = this.detectMagicMime(file.buffer, file.originalname);
    if (spoofDetected) {
      throw new BadRequestException(`File rejected: MIME spoofing detected. ${spoofReason}`);
    }
    const allowedTypes = this.configService.vaultAllowedFileTypes;
    if (allowedTypes !== '*' && !allowedTypes.split(',').includes(detectedMime)) {
      throw new BadRequestException(`File type ${detectedMime} is not allowed by storage policy.`);
    }

    if (folderId) {
      const folder = await this.repository.findFolderById(folderId, userId);
      if (!folder) throw new NotFoundException('Target folder not found.');
    }

    // 3. Encrypt file buffer using AES-256-GCM
    const dek = await this.getOrCreateUserDEK(userId);
    const contentIv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, dek, contentIv);

    let encryptedData: Buffer;
    let contentAuthTag: string;
    const storageKey = crypto.randomUUID(); // Random storage identifier

    try {
      encryptedData = Buffer.concat([cipher.update(file.buffer), cipher.final()]);
      contentAuthTag = cipher.getAuthTag().toString('base64');
    } catch (err) {
      throw new BadRequestException('Failed to encrypt file payload.');
    }

    // 4. Persistence block (Private Storage write & Metadata update)
    let fileRecord: any = null;
    try {
      // Put to physical storage
      await this.storage.put(storageKey, encryptedData);

      const userKey = await this.repository.findUserKey(userId);
      const dekVersion = userKey ? userKey.kekVersion : 1;

      const ext = path.extname(file.originalname).replace('.', '').toLowerCase();
      const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');

      fileRecord = await this.repository.createFile(userId, {
        name: file.originalname,
        storagePath: storageKey,
        fileSize: BigInt(file.size),
        extension: ext,
        checksum: hash,
        status: FileStatus.READY, // Validated and ready for attachment
        mimeType: detectedMime,
        originalFilename: file.originalname,
        contentIv: contentIv.toString('base64'),
        contentAuthTag,
        dekVersion,
        folderId,
      });

      await this.eventBus.publish(
        VaultFileUploadedEvent.eventName,
        new VaultFileUploadedEvent(fileRecord.id, userId, { name: fileRecord.name })
      );

      return fileRecord;
    } catch (err: any) {
      // Safe cleanup: delete storage key on failure to prevent orphaned objects
      try {
        await this.storage.delete(storageKey);
      } catch (cleanupErr) {
        this.logger.error(`Storage cleanup failure for key ${storageKey}: ${cleanupErr}`);
      }
      throw new BadRequestException(`Failed to persist file: ${err.message}`);
    }
  }

  /**
   * Decrypts and streams the file contents.
   */
  async downloadFile(userId: string, fileId: string): Promise<{ filename: string; mimeType: string; data: Buffer }> {
    const file = await this.repository.findFileById(fileId, userId);
    if (!file) throw new NotFoundException('Vault file not found.');
    if (file.status !== FileStatus.READY) {
      throw new BadRequestException(`File is not in READY status (current status: ${file.status}).`);
    }

    // Guarantee synchronous audit log write before revealing the file
    await this.writeAuditSync(userId, 'vault_files', fileId, AuditAction.SECURITY_FLAG, null, {
      action: 'DOWNLOAD_FILE',
      name: file.name,
    });

    // Read encrypted bytes
    const exists = await this.storage.exists(file.storagePath);
    if (!exists) {
      throw new NotFoundException('Physical file not found in vault storage.');
    }

    const stream = await this.storage.getStream(file.storagePath);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const encryptedData = Buffer.concat(chunks);

    if (!file.contentIv || !file.contentAuthTag) {
      throw new BadRequestException('Cryptographic metadata missing for requested file.');
    }

    // Decrypt in memory
    const dek = await this.getOrCreateUserDEK(userId);
    try {
      const ivBuffer = Buffer.from(file.contentIv, 'base64');
      const tagBuffer = Buffer.from(file.contentAuthTag, 'base64');
      const decipher = crypto.createDecipheriv(this.algorithm, dek, ivBuffer);
      decipher.setAuthTag(tagBuffer);

      const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

      return {
        filename: file.name,
        mimeType: file.mimeType || 'application/octet-stream',
        data: decrypted,
      };
    } catch (err) {
      throw new BadRequestException('Failed to decrypt file payload. Authentication failed.');
    }
  }

  async deleteFile(userId: string, id: string, version: number) {
    const file = await this.repository.findFileById(id, userId);
    if (!file) throw new NotFoundException('Vault file not found.');

    // Soft delete in DB
    const updated = await this.repository.updateFile(id, userId, version, { status: FileStatus.DELETED, deletedAt: new Date() });

    // Try deleting from physical storage immediately to satisfy safe deletion
    try {
      await this.storage.delete(file.storagePath);
    } catch (err) {
      this.logger.error(`Failed to delete physical file ${file.storagePath} from disk: ${err}`);
    }

    await this.eventBus.publish(
      VaultFileDeletedEvent.eventName,
      new VaultFileDeletedEvent(id, userId)
    );

    return updated;
  }

  /**
   * Detects MIME type from magic bytes as the authoritative signal.
   * Returns { detectedMime, spoofDetected, spoofReason }.
   * For formats with no reliable magic signature (CSV, plain text), extension is used as a fallback
   * but binary executable magic headers are still checked to prevent spoofed uploads.
   */
  private detectMagicMime(
    buffer: Buffer,
    originalname: string
  ): { detectedMime: string; spoofDetected: boolean; spoofReason: string } {
    if (buffer.length < 4) {
      return { detectedMime: 'application/octet-stream', spoofDetected: false, spoofReason: '' };
    }

    const hex4 = buffer.toString('hex', 0, 4).toUpperCase();
    const hex8 = buffer.length >= 8 ? buffer.toString('hex', 0, 8).toUpperCase() : hex4;
    const ext = path.extname(originalname).toLowerCase();

    // ─── Magic-byte detection (authoritative) ───
    let magicMime: string | null = null;

    if (hex4 === '25504446') magicMime = 'application/pdf';
    else if (hex4 === '89504E47') magicMime = 'image/png';
    else if (hex4.startsWith('FFD8FF')) magicMime = 'image/jpeg';
    else if (hex4 === '504B0304') magicMime = 'application/zip';
    else if (hex4 === '47494638') magicMime = 'image/gif';
    else if (hex4 === '49492A00' || hex4 === '4D4D002A') magicMime = 'image/tiff';
    else if (hex8 === '377ABCAF271C') magicMime = 'application/x-7z-compressed';
    // ELF (Linux executable) / PE (Windows .exe .dll) — always rejected
    else if (hex4 === '7F454C46') magicMime = 'application/x-elf';
    else if (hex4 === '4D5A9000' || hex4.startsWith('4D5A')) magicMime = 'application/x-msdownload';
    // Office Open XML (docx/xlsx): ZIP container — already caught above as application/zip

    // ─── Text / CSV fallback (no reliable magic bytes) ───
    // These are only used if no binary magic was detected.
    if (magicMime === null) {
      let isText = true;
      for (let i = 0; i < Math.min(buffer.length, 512); i++) {
        const b = buffer[i];
        // Allow: tab(9), LF(10), CR(13), printable ASCII (32–126), common UTF-8 continuation
        if (b < 9 || (b > 13 && b < 32)) {
          isText = false;
          break;
        }
      }
      if (isText) {
        // CSV has no magic — trust extension as valid (it is text and named .csv)
        if (ext === '.csv') magicMime = 'text/csv';
        else magicMime = 'text/plain';
      } else {
        magicMime = 'application/octet-stream';
      }
    }

    // ─── Spoofing check: reject if magic-detected MIME contradicts the extension ───
    // For text formats (no reliable magic), skip this check since magic=null path was used.
    const executableMimes = new Set([
      'application/x-elf', 'application/x-msdownload', 'application/x-msdos-program',
    ]);
    if (executableMimes.has(magicMime!)) {
      return {
        detectedMime: magicMime!,
        spoofDetected: true,
        spoofReason: `Executable binary content (${magicMime}) is not permitted.`,
      };
    }

    // Extension-to-authoritative-MIME map for spoofing verification
    const extMimeExpectations: Record<string, string[]> = {
      '.pdf':  ['application/pdf'],
      '.png':  ['image/png'],
      '.jpg':  ['image/jpeg'],
      '.jpeg': ['image/jpeg'],
      '.gif':  ['image/gif'],
      '.tif':  ['image/tiff'],
      '.tiff': ['image/tiff'],
      '.zip':  ['application/zip'],
      '.docx': ['application/zip'],  // OOXML is a zip container
      '.xlsx': ['application/zip'],
      '.csv':  ['text/csv', 'text/plain'],
      '.txt':  ['text/plain', 'text/csv'],
    };

    if (ext && extMimeExpectations[ext]) {
      const expected = extMimeExpectations[ext];
      if (!expected.includes(magicMime!)) {
        return {
          detectedMime: magicMime!,
          spoofDetected: true,
          spoofReason: `Extension ${ext} expects ${expected.join(' or ')} but file content signature is ${magicMime}.`,
        };
      }
    }

    return { detectedMime: magicMime!, spoofDetected: false, spoofReason: '' };
  }

  // ─── Key Rotation Operations ───

  /**
   * KEK Rotation: Re-wraps all users DEKs with a new KEK (Master Key).
   * Does NOT decrypt VaultItems or VaultFiles content ciphertext.
   */
  /**
   * KEK Rotation: Prepare-then-commit pattern.
   * Phase 1: All crypto (unwrap + re-wrap) runs OUTSIDE any transaction.
   * Phase 2: A short atomic Prisma transaction persists ALL rewrapped DEKs at once.
   * If Phase 1 fails for any user, no DB changes are made.
   * If Phase 2 (transaction) fails, DB state is untouched (old wrapped keys intact).
   */
  async rotateKEK(oldKekBase64: string, newKekBase64: string, newKekVersion: number): Promise<void> {
    const oldKek = Buffer.from(oldKekBase64, 'base64');
    const newKek = Buffer.from(newKekBase64, 'base64');

    if (oldKek.length !== 32 || newKek.length !== 32) {
      throw new Error('Both old and new KEK must decode to exactly 32 bytes.');
    }

    const userKeys = await this.repository.listAllUserKeys();
    this.logger.log(`Starting KEK Rotation (rewrapping) prepare phase for ${userKeys.length} users...`);

    // ─── Phase 1: Prepare — all crypto outside the transaction ───
    const prepared: Array<{
      userId: string;
      wrappedKey: string;
      wrapIv: string;
      wrapAuthTag: string;
      wrappingAlgorithm: string;
      kekVersion: number;
    }> = [];

    for (const uk of userKeys) {
      // Unwrap DEK using old KEK (throws if old KEK is wrong → aborts before any write)
      const rawDek = await this.kms.unwrapKey(uk.wrappedKey, uk.wrapIv, uk.wrapAuthTag, oldKek);
      // Re-wrap with new KEK (cryptographically validates the output)
      const rewrapped = await this.kms.wrapKey(rawDek, newKek, newKekVersion);
      // Verify: round-trip decryption of the new wrapped key to catch any wrapping corruption
      const verify = await this.kms.unwrapKey(rewrapped.wrappedKey, rewrapped.wrapIv, rewrapped.wrapAuthTag, newKek);
      if (!verify.equals(rawDek)) {
        throw new Error(`KEK rotation crypto validation failed for user ${uk.userId}. Aborting before any DB writes.`);
      }
      prepared.push({ userId: uk.userId, ...rewrapped });
    }

    this.logger.log(`Prepare phase complete. Committing ${prepared.length} rewrapped DEKs atomically...`);

    // ─── Phase 2: Commit — short atomic transaction (persistence only, no crypto) ───
    await this.prisma.$transaction(
      prepared.map((p) =>
        this.prisma.vaultUserKey.update({
          where: { userId: p.userId },
          data: {
            wrappedKey: p.wrappedKey,
            wrapIv: p.wrapIv,
            wrapAuthTag: p.wrapAuthTag,
            wrappingAlgorithm: p.wrappingAlgorithm,
            kekVersion: p.kekVersion,
            rotatedAt: new Date(),
          },
        })
      )
    );

    // Audit write after successful commit
    await this.writeAuditSync('system', 'vault_user_keys', 'system', AuditAction.SECURITY_FLAG, null, {
      action: 'ROTATE_KEK',
      newVersion: newKekVersion,
      usersRotated: prepared.length,
    });

    await this.eventBus.publish(
      VaultKeyRotatedEvent.eventName,
      new VaultKeyRotatedEvent('system', 'system', { type: 'KEK', version: newKekVersion })
    );

    this.logger.log('KEK Rotation completed successfully.');
  }

  /**
   * DEK Rotation: Re-encrypts all items and files of a user with a new DEK.
   */
  /**
   * DEK Rotation with temp-file approach for atomicity:
   * Phase 1: Prepare all new item ciphertexts in memory.
   * Phase 2: Write newly encrypted files to TEMP storage keys (not replacing originals).
   * Phase 3: Commit all DB updates (item ciphertexts + file metadata + new wrapped DEK) in ONE transaction.
   * On success: delete old physical files.
   * On Phase 2/3 failure: clean up temp files; original files and DB remain untouched.
   */
  async rotateDEK(userId: string): Promise<void> {
    this.logger.log(`Starting DEK Rotation for user ${userId}...`);

    const oldDek = await this.getOrCreateUserDEK(userId);
    const newDek = await this.kms.generateDataKey();

    // ─── Phase 1: Re-encrypt all VaultItems (in memory, no DB writes yet) ───
    const items = await this.repository.listAllItemsForDEKRotation(userId);
    const itemUpdates: Array<{
      id: string;
      version: number;
      ciphertext: string;
      contentIv: string;
      contentAuthTag: string;
      dekVersion: number;
    }> = [];

    for (const item of items) {
      const ivBuffer = Buffer.from(item.contentIv, 'base64');
      const tagBuffer = Buffer.from(item.contentAuthTag, 'base64');
      const decipher = crypto.createDecipheriv(this.algorithm, oldDek, ivBuffer);
      decipher.setAuthTag(tagBuffer);
      const plaintext = Buffer.concat([decipher.update(Buffer.from(item.ciphertext, 'base64')), decipher.final()]).toString('utf8');

      const newIv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(this.algorithm, newDek, newIv);
      const newEncrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const newAuthTag = cipher.getAuthTag();

      itemUpdates.push({
        id: item.id,
        version: item.version,
        ciphertext: newEncrypted.toString('base64'),
        contentIv: newIv.toString('base64'),
        contentAuthTag: newAuthTag.toString('base64'),
        dekVersion: item.dekVersion + 1,
      });
    }

    // ─── Phase 2: Re-encrypt all VaultFiles to TEMP storage keys ───
    const files = await this.repository.listAllFilesForDEKRotation(userId);
    const fileUpdates: Array<{
      id: string;
      oldStorageKey: string;
      newStorageKey: string;
      newContentIv: string;
      newContentAuthTag: string;
      dekVersion: number;
    }> = [];

    const tempStorageKeys: string[] = []; // track for cleanup on failure
    try {
      for (const file of files) {
        if (file.status !== FileStatus.READY || !file.contentIv || !file.contentAuthTag) continue;

        const stream = await this.storage.getStream(file.storagePath);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(Buffer.from(chunk));
        const encryptedData = Buffer.concat(chunks);

        const ivBuffer = Buffer.from(file.contentIv, 'base64');
        const tagBuffer = Buffer.from(file.contentAuthTag, 'base64');
        const decipher = crypto.createDecipheriv(this.algorithm, oldDek, ivBuffer);
        decipher.setAuthTag(tagBuffer);
        const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

        const newIv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv(this.algorithm, newDek, newIv);
        const newEncrypted = Buffer.concat([cipher.update(decrypted), cipher.final()]);
        const newAuthTag = cipher.getAuthTag();

        // Write to a NEW temp key — original file untouched
        const tempKey = `dek_rotation_tmp_${crypto.randomUUID()}`;
        await this.storage.put(tempKey, newEncrypted);
        tempStorageKeys.push(tempKey);

        fileUpdates.push({
          id: file.id,
          oldStorageKey: file.storagePath,
          newStorageKey: tempKey,
          newContentIv: newIv.toString('base64'),
          newContentAuthTag: newAuthTag.toString('base64'),
          dekVersion: file.dekVersion + 1,
        });
      }
    } catch (fileErr: any) {
      // Phase 2 failure: clean up any temp files written so far
      for (const tmpKey of tempStorageKeys) {
        try { await this.storage.delete(tmpKey); } catch {}
      }
      throw new BadRequestException(`DEK rotation failed during file re-encryption: ${fileErr.message}`);
    }

    // ─── Phase 3: Wrap new DEK and commit everything atomically ───
    const kek = this.getMasterKeyBuffer();
    const userKey = await this.repository.findUserKey(userId);
    const nextVersion = userKey ? userKey.kekVersion + 1 : 1;
    const wrapped = await this.kms.wrapKey(newDek, kek, nextVersion);

    const store = loggerContextStorage.getStore();
    const requestId = store?.requestId || null;
    const correlationId = store?.correlationId || crypto.randomUUID();

    try {
      await this.prisma.$transaction([
        // Update all item ciphertexts
        ...itemUpdates.map((u) =>
          this.prisma.vaultItem.update({
            where: { id: u.id },
            data: {
              ciphertext: u.ciphertext,
              contentIv: u.contentIv,
              contentAuthTag: u.contentAuthTag,
              dekVersion: u.dekVersion,
              version: { increment: 1 },
            },
          })
        ),
        // Update all file metadata (pointing to new temp storage key)
        ...fileUpdates.map((f) =>
          this.prisma.vaultFile.update({
            where: { id: f.id },
            data: {
              storagePath: f.newStorageKey,
              contentIv: f.newContentIv,
              contentAuthTag: f.newContentAuthTag,
              dekVersion: f.dekVersion,
              version: { increment: 1 },
            },
          })
        ),
        // Update wrapped DEK envelope
        this.prisma.vaultUserKey.update({
          where: { userId },
          data: {
            wrappedKey: wrapped.wrappedKey,
            wrapIv: wrapped.wrapIv,
            wrapAuthTag: wrapped.wrapAuthTag,
            wrappingAlgorithm: wrapped.wrappingAlgorithm,
            kekVersion: wrapped.kekVersion,
            rotatedAt: new Date(),
          },
        }),
        // Audit log in same transaction
        this.prisma.auditLog.create({
          data: {
            userId,
            tableName: 'vault_user_keys',
            recordId: userId,
            action: AuditAction.SECURITY_FLAG,
            newValue: { action: 'ROTATE_DEK', version: nextVersion } as any,
            requestId,
            correlationId,
            version: 1,
          },
        }),
      ]);
    } catch (txErr: any) {
      // Transaction failed: DB state intact. Clean up temp storage files.
      for (const f of fileUpdates) {
        try { await this.storage.delete(f.newStorageKey); } catch {}
      }
      throw new BadRequestException(`DEK rotation transaction failed: ${txErr.message}. Original keys and files are intact.`);
    }

    // ─── Post-commit: delete old physical files (now safe) ───
    for (const f of fileUpdates) {
      try {
        await this.storage.delete(f.oldStorageKey);
      } catch (cleanupErr) {
        this.logger.error(`Post-DEK-rotation cleanup: failed to delete old file ${f.oldStorageKey}: ${cleanupErr}`);
      }
    }

    await this.eventBus.publish(
      VaultKeyRotatedEvent.eventName,
      new VaultKeyRotatedEvent(userId, userId, { type: 'DEK', version: nextVersion })
    );

    this.logger.log(`DEK Rotation completed successfully for user ${userId}.`);
  }

  /**
   * Synchronously writes an audit log in the database.
   * If this write fails, it throws an error to rollback or abort the request.
   */
  private async writeAuditSync(
    userId: string,
    tableName: string,
    recordId: string,
    action: AuditAction,
    oldValue: any,
    newValue: any
  ): Promise<void> {
    const store = loggerContextStorage.getStore();
    const requestId = store?.requestId || null;
    const correlationId = store?.correlationId || crypto.randomUUID();

    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          tableName,
          recordId,
          action,
          oldValue: oldValue || undefined,
          newValue: newValue || undefined,
          requestId,
          correlationId,
          version: 1,
        },
      });
    } catch (err: any) {
      this.logger.error(`CRITICAL: Failed to persist synchronous audit log: ${err.message}`);
      throw new BadRequestException('Security policy violation: Failed to generate audit trail.');
    }
  }

  // Helper for Prisma direct access
  private get prisma() {
    return (this.repository as any).prisma;
  }
}
