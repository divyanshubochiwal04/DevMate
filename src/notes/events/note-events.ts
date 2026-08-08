export class NoteCreatedEventPayload {
  static readonly eventName = 'NoteCreated';
  constructor(
    public readonly noteId: string,
    public readonly userId: string,
    public readonly title: string,
    public readonly createdAt: Date
  ) {}
}

export class NoteUpdatedEventPayload {
  static readonly eventName = 'NoteUpdated';
  constructor(
    public readonly noteId: string,
    public readonly userId: string,
    public readonly title: string,
    public readonly version: number,
    public readonly updatedAt: Date
  ) {}
}

export class NoteArchivedEventPayload {
  static readonly eventName = 'NoteArchived';
  constructor(
    public readonly noteId: string,
    public readonly userId: string,
    public readonly archivedAt: Date
  ) {}
}

export class NoteDeletedEventPayload {
  static readonly eventName = 'NoteDeleted';
  constructor(
    public readonly noteId: string,
    public readonly userId: string,
    public readonly deletedAt: Date
  ) {}
}

export class NotePinnedEventPayload {
  static readonly eventName = 'NotePinned';
  constructor(
    public readonly noteId: string,
    public readonly userId: string,
    public readonly isPinned: boolean,
    public readonly updatedAt: Date
  ) {}
}

export class NoteRestoredEventPayload {
  static readonly eventName = 'NoteRestored';
  constructor(
    public readonly noteId: string,
    public readonly userId: string,
    public readonly restoredAt: Date
  ) {}
}
