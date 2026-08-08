export interface IReminderExecutor {
  schedule(reminderId: string, executeAt: Date): Promise<void>;
  cancel(reminderId: string): Promise<void>;
}

export const IReminderExecutor = Symbol('IReminderExecutor');
