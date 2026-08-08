export class TodoCreatedEventPayload {
  static readonly eventName = 'TodoCreated';
  constructor(
    public readonly todoId: string,
    public readonly userId: string,
    public readonly title: string,
    public readonly priority: string,
    public readonly status: string,
    public readonly createdAt: Date
  ) {}
}

export class TodoUpdatedEventPayload {
  static readonly eventName = 'TodoUpdated';
  constructor(
    public readonly todoId: string,
    public readonly userId: string,
    public readonly title: string,
    public readonly priority: string,
    public readonly status: string,
    public readonly version: number,
    public readonly updatedAt: Date,
    public readonly changeDetails?: Record<string, { old: any; new: any }>
  ) {}
}

export class TodoCompletedEventPayload {
  static readonly eventName = 'TodoCompleted';
  constructor(
    public readonly todoId: string,
    public readonly userId: string,
    public readonly completedById: string,
    public readonly completedAt: Date
  ) {}
}

export class TodoArchivedEventPayload {
  static readonly eventName = 'TodoArchived';
  constructor(
    public readonly todoId: string,
    public readonly userId: string,
    public readonly archivedById: string,
    public readonly archivedAt: Date
  ) {}
}

export class TodoDeletedEventPayload {
  static readonly eventName = 'TodoDeleted';
  constructor(
    public readonly todoId: string,
    public readonly userId: string,
    public readonly deletedById: string,
    public readonly deletedAt: Date
  ) {}
}

export class SubtaskCreatedEventPayload {
  static readonly eventName = 'SubtaskCreated';
  constructor(
    public readonly parentTodoId: string,
    public readonly subtaskTodoId: string,
    public readonly userId: string,
    public readonly title: string,
    public readonly createdAt: Date
  ) {}
}
