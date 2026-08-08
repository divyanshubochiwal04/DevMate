export class ChecklistItemEntity {
  id!: string;
  title!: string;
  isCompleted!: boolean;

  constructor(partial: Partial<ChecklistItemEntity>) {
    Object.assign(this, partial);
  }
}

export class ChecklistEntity {
  id!: string;
  title!: string;
  items!: ChecklistItemEntity[];

  constructor(partial: Partial<ChecklistEntity>) {
    Object.assign(this, partial);
  }
}

export class TodoCommentEntity {
  id!: string;
  userId!: string;
  username!: string | null;
  content!: string;
  createdAt!: Date;

  constructor(partial: Partial<TodoCommentEntity>) {
    Object.assign(this, partial);
  }
}

export class TodoAttachmentEntity {
  id!: string;
  vaultFileId!: string;
  fileName!: string;

  constructor(partial: Partial<TodoAttachmentEntity>) {
    Object.assign(this, partial);
  }
}

export class TodoEntity {
  id!: string;
  title!: string;
  description!: string | null;
  priority!: string;
  status!: string;
  projectId!: string | null;
  projectName!: string | null;
  listId!: string | null;
  listName!: string | null;
  startDate!: Date | null;
  dueDate!: Date | null;
  completedAt!: Date | null;
  estimatedDuration!: number | null; // In minutes
  actualDuration!: number | null;    // In minutes
  recurrenceRule!: string | null;
  parentTodoId!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
  deletedAt!: Date | null;
  createdBy!: string | null;
  updatedBy!: string | null;
  completedById!: string | null;
  archivedById!: string | null;
  archivedAt!: Date | null;
  version!: number;

  labels!: string[];
  subtasks!: string[];
  dependencies!: string[];
  attachments!: TodoAttachmentEntity[];
  comments!: TodoCommentEntity[];
  checklists!: ChecklistEntity[];

  constructor(partial: Partial<TodoEntity>) {
    Object.assign(this, partial);
  }
}
