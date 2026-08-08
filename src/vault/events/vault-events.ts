export class VaultItemCreatedEvent {
  static readonly eventName = 'vault.item.created';
  constructor(
    public readonly itemId: string,
    public readonly userId: string,
    public readonly metadata: { type: string; title: string }
  ) {}
}

export class VaultItemUpdatedEvent {
  static readonly eventName = 'vault.item.updated';
  constructor(
    public readonly itemId: string,
    public readonly userId: string,
    public readonly metadata: { title?: string }
  ) {}
}

export class VaultItemDeletedEvent {
  static readonly eventName = 'vault.item.deleted';
  constructor(
    public readonly itemId: string,
    public readonly userId: string
  ) {}
}

export class VaultItemRestoredEvent {
  static readonly eventName = 'vault.item.restored';
  constructor(
    public readonly itemId: string,
    public readonly userId: string
  ) {}
}

export class VaultFileUploadedEvent {
  static readonly eventName = 'vault.file.uploaded';
  constructor(
    public readonly fileId: string,
    public readonly userId: string,
    public readonly metadata: { name: string }
  ) {}
}

export class VaultFileDeletedEvent {
  static readonly eventName = 'vault.file.deleted';
  constructor(
    public readonly fileId: string,
    public readonly userId: string
  ) {}
}

export class VaultKeyRotatedEvent {
  static readonly eventName = 'vault.key.rotated';
  constructor(
    public readonly userId: string,
    public readonly initiatedBy: string,
    public readonly metadata: { type: 'KEK' | 'DEK'; version: number }
  ) {}
}
