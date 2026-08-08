import { Injectable, BadRequestException } from '@nestjs/common';
import { IKeyManagementService, WrappedKeyResult } from '../interfaces/key-management.interface';
import * as crypto from 'crypto';
import { Buffer } from 'buffer';

@Injectable()
export class LocalKeyManagementService implements IKeyManagementService {
  private readonly algorithm = 'aes-256-gcm';

  async wrapKey(dek: Buffer, kek: Buffer, kekVersion: number): Promise<WrappedKeyResult> {
    if (kek.length !== 32) {
      throw new BadRequestException('Master key (KEK) must be exactly 32 bytes.');
    }

    // Always generate a fresh random IV/nonce for wrapping
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, kek, iv);

    const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      wrappedKey: encrypted.toString('base64'),
      wrapIv: iv.toString('base64'),
      wrapAuthTag: authTag.toString('base64'),
      wrappingAlgorithm: this.algorithm,
      kekVersion,
    };
  }

  async unwrapKey(wrappedKey: string, wrapIv: string, wrapAuthTag: string, kek: Buffer): Promise<Buffer> {
    if (kek.length !== 32) {
      throw new BadRequestException('Master key (KEK) must be exactly 32 bytes.');
    }

    try {
      const ivBuffer = Buffer.from(wrapIv, 'base64');
      const tagBuffer = Buffer.from(wrapAuthTag, 'base64');
      const encryptedBuffer = Buffer.from(wrappedKey, 'base64');

      const decipher = crypto.createDecipheriv(this.algorithm, kek, ivBuffer);
      decipher.setAuthTag(tagBuffer);

      return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
    } catch (err: any) {
      throw new BadRequestException('Failed to unwrap Data Encryption Key. Authenticated decryption failed (bad key or metadata).');
    }
  }

  async generateDataKey(): Promise<Buffer> {
    return crypto.randomBytes(32);
  }
}
