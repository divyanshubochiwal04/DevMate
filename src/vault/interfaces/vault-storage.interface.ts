export const IVaultStorageProvider = Symbol('IVaultStorageProvider');

export interface IVaultStorageProvider {
  /**
   * Writes the file contents to persistent storage.
   */
  put(storageKey: string, data: Buffer): Promise<void>;

  /**
   * Retrieves a read stream for the storage key.
   */
  getStream(storageKey: string): Promise<NodeJS.ReadableStream>;

  /**
   * Physically deletes the file corresponding to the storage key.
   */
  delete(storageKey: string): Promise<void>;

  /**
   * Checks if the file corresponding to the storage key exists.
   */
  exists(storageKey: string): Promise<boolean>;
}
