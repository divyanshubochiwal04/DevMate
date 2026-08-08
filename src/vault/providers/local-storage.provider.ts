import { Injectable, ForbiddenException } from '@nestjs/common';
import { IVaultStorageProvider } from '../interfaces/vault-storage.interface';
import { ConfigService } from '../../config/config.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LocalStorageProvider implements IVaultStorageProvider {
  private readonly storageRoot: string;

  constructor(private readonly configService: ConfigService) {
    // Resolve relative path to root or absolute path
    const configuredPath = this.configService.vaultLocalStoragePath || 'storage/vault';
    this.storageRoot = path.resolve(configuredPath);
    
    // Ensure directory exists
    if (!fs.existsSync(this.storageRoot)) {
      fs.mkdirSync(this.storageRoot, { recursive: true });
    }
  }

  private getAndValidatePath(storageKey: string): string {
    const rootAbsolute = path.resolve(this.storageRoot);
    const fileAbsolute = path.resolve(rootAbsolute, storageKey);

    // Enforce path containment
    if (!fileAbsolute.startsWith(rootAbsolute)) {
      throw new ForbiddenException('Path traversal attempt blocked. Storage path escapes vault root.');
    }

    return fileAbsolute;
  }

  async put(storageKey: string, data: Buffer): Promise<void> {
    const filePath = this.getAndValidatePath(storageKey);
    // Ensure parent folders exist just in case nested keys are used
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    await fs.promises.writeFile(filePath, data);
  }

  async getStream(storageKey: string): Promise<NodeJS.ReadableStream> {
    const filePath = this.getAndValidatePath(storageKey);
    if (!fs.existsSync(filePath)) {
      throw new ForbiddenException('Requested storage file does not exist.');
    }
    return fs.createReadStream(filePath);
  }

  async delete(storageKey: string): Promise<void> {
    const filePath = this.getAndValidatePath(storageKey);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      const filePath = this.getAndValidatePath(storageKey);
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }
}
