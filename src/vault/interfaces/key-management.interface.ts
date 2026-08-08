import { Buffer } from 'buffer';

export interface WrappedKeyResult {
  wrappedKey: string;      // Base64
  wrapIv: string;          // Base64
  wrapAuthTag: string;     // Base64
  wrappingAlgorithm: string;
  kekVersion: number;
}

export const IKeyManagementService = Symbol('IKeyManagementService');

export interface IKeyManagementService {
  /**
   * Encrypts/wraps a Data Encryption Key (DEK) using a Master Key (KEK) via AES-256-GCM.
   */
  wrapKey(dek: Buffer, kek: Buffer, kekVersion: number): Promise<WrappedKeyResult>;

  /**
   * Decrypts/unwraps a wrapped DEK using a KEK.
   */
  unwrapKey(wrappedKey: string, wrapIv: string, wrapAuthTag: string, kek: Buffer): Promise<Buffer>;

  /**
   * Generates a cryptographically secure random 256-bit (32-byte) DEK.
   */
  generateDataKey(): Promise<Buffer>;
}
