/**
 * Permission — the single source of truth for all permission strings.
 *
 * These constants are:
 * - Seeded into the `permissions` table at startup
 * - Referenced in @RequirePermissions() decorators (never raw strings)
 * - Grouped by resource for clarity
 *
 * Convention: `<resource>.<action>`
 */
export const Permission = {
  // ─── User Management ────────────────────────────────────────────────────────
  USER_CREATE:  "user.create",
  USER_READ:    "user.read",
  USER_UPDATE:  "user.update",
  USER_DELETE:  "user.delete",
  USER_SUSPEND: "user.suspend",

  // ─── Todo ───────────────────────────────────────────────────────────────────
  TODO_CREATE: "todo.create",
  TODO_READ:   "todo.read",
  TODO_UPDATE: "todo.update",
  TODO_DELETE: "todo.delete",

  // ─── Reminders ──────────────────────────────────────────────────────────────
  REMINDER_CREATE: "reminder.create",
  REMINDER_READ:   "reminder.read",
  REMINDER_UPDATE: "reminder.update",
  REMINDER_DELETE: "reminder.delete",

  // ─── Goals ──────────────────────────────────────────────────────────────────
  GOAL_CREATE: "goal.create",
  GOAL_READ:   "goal.read",
  GOAL_UPDATE: "goal.update",
  GOAL_DELETE: "goal.delete",

  // ─── Expenses & Finance ─────────────────────────────────────────────────────
  EXPENSE_CREATE: "expense.create",
  EXPENSE_READ:   "expense.read",
  EXPENSE_UPDATE: "expense.update",
  EXPENSE_DELETE: "expense.delete",

  LOAN_CREATE: "loan.create",
  LOAN_READ:   "loan.read",
  LOAN_UPDATE: "loan.update",
  LOAN_DELETE: "loan.delete",

  SUBSCRIPTION_CREATE: "subscription.create",
  SUBSCRIPTION_READ:   "subscription.read",
  SUBSCRIPTION_UPDATE: "subscription.update",
  SUBSCRIPTION_DELETE: "subscription.delete",

  BUDGET_CREATE: "budget.create",
  BUDGET_READ:   "budget.read",
  BUDGET_UPDATE: "budget.update",
  BUDGET_DELETE: "budget.delete",

  // ─── Splitter ───────────────────────────────────────────────────────────────
  SPLITTER_CREATE: "splitter.create",
  SPLITTER_READ:   "splitter.read",
  SPLITTER_UPDATE: "splitter.update",
  SPLITTER_DELETE: "splitter.delete",

  // ─── Notes ──────────────────────────────────────────────────────────────────
  NOTE_CREATE: "note.create",
  NOTE_READ:   "note.read",
  NOTE_UPDATE: "note.update",
  NOTE_DELETE: "note.delete",

  // ─── Vault ──────────────────────────────────────────────────────────────────
  VAULT_UPLOAD:   "vault.upload",
  VAULT_DOWNLOAD: "vault.download",
  VAULT_UPDATE:   "vault.update",
  VAULT_DELETE:   "vault.delete",
  VAULT_MANAGE:   "vault.manage",

  // ─── Calendar ───────────────────────────────────────────────────────────────
  CALENDAR_CREATE: "calendar.create",
  CALENDAR_READ:   "calendar.read",
  CALENDAR_UPDATE: "calendar.update",
  CALENDAR_DELETE: "calendar.delete",

  // ─── Birthdays ──────────────────────────────────────────────────────────────
  BIRTHDAY_CREATE: "birthday.create",
  BIRTHDAY_READ:   "birthday.read",
  BIRTHDAY_UPDATE: "birthday.update",
  BIRTHDAY_DELETE: "birthday.delete",

  // ─── Telegram ───────────────────────────────────────────────────────────────
  TELEGRAM_SEND:   "telegram.send",
  TELEGRAM_MANAGE: "telegram.manage",

  // ─── AI ─────────────────────────────────────────────────────────────────────
  AI_USE:    "ai.use",
  AI_MANAGE: "ai.manage",

  // ─── Notifications ──────────────────────────────────────────────────────────
  NOTIFICATION_READ:   "notification.read",
  NOTIFICATION_MANAGE: "notification.manage",

  // ─── Admin ──────────────────────────────────────────────────────────────────
  ADMIN_MANAGE:  "admin.manage",

  // ─── System (Super Admin only) ──────────────────────────────────────────────
  SYSTEM_MANAGE: "system.manage",
} as const;

/** The union type of all valid permission strings */
export type PermissionKey = (typeof Permission)[keyof typeof Permission];

/** Grouped labels for seeding the permission_groups table */
export const PermissionGroups: Record<string, string[]> = {
  "User Management": [
    Permission.USER_CREATE, Permission.USER_READ,
    Permission.USER_UPDATE, Permission.USER_DELETE, Permission.USER_SUSPEND,
  ],
  "Todo": [
    Permission.TODO_CREATE, Permission.TODO_READ,
    Permission.TODO_UPDATE, Permission.TODO_DELETE,
  ],
  "Reminder": [
    Permission.REMINDER_CREATE, Permission.REMINDER_READ,
    Permission.REMINDER_UPDATE, Permission.REMINDER_DELETE,
  ],
  "Goal": [
    Permission.GOAL_CREATE, Permission.GOAL_READ,
    Permission.GOAL_UPDATE, Permission.GOAL_DELETE,
  ],
  "Expense": [
    Permission.EXPENSE_CREATE, Permission.EXPENSE_READ,
    Permission.EXPENSE_UPDATE, Permission.EXPENSE_DELETE,
  ],
  "Loan": [
    Permission.LOAN_CREATE, Permission.LOAN_READ,
    Permission.LOAN_UPDATE, Permission.LOAN_DELETE,
  ],
  "Subscription": [
    Permission.SUBSCRIPTION_CREATE, Permission.SUBSCRIPTION_READ,
    Permission.SUBSCRIPTION_UPDATE, Permission.SUBSCRIPTION_DELETE,
  ],
  "Budget": [
    Permission.BUDGET_CREATE, Permission.BUDGET_READ,
    Permission.BUDGET_UPDATE, Permission.BUDGET_DELETE,
  ],
  "Splitter": [
    Permission.SPLITTER_CREATE, Permission.SPLITTER_READ,
    Permission.SPLITTER_UPDATE, Permission.SPLITTER_DELETE,
  ],
  "Note": [
    Permission.NOTE_CREATE, Permission.NOTE_READ,
    Permission.NOTE_UPDATE, Permission.NOTE_DELETE,
  ],
  "Vault": [
    Permission.VAULT_UPLOAD, Permission.VAULT_DOWNLOAD,
    Permission.VAULT_UPDATE, Permission.VAULT_DELETE, Permission.VAULT_MANAGE,
  ],
  "Calendar": [
    Permission.CALENDAR_CREATE, Permission.CALENDAR_READ,
    Permission.CALENDAR_UPDATE, Permission.CALENDAR_DELETE,
  ],
  "Birthday": [
    Permission.BIRTHDAY_CREATE, Permission.BIRTHDAY_READ,
    Permission.BIRTHDAY_UPDATE, Permission.BIRTHDAY_DELETE,
  ],
  "Telegram": [Permission.TELEGRAM_SEND, Permission.TELEGRAM_MANAGE],
  "AI": [Permission.AI_USE, Permission.AI_MANAGE],
  "Notification": [Permission.NOTIFICATION_READ, Permission.NOTIFICATION_MANAGE],
  "Admin": [Permission.ADMIN_MANAGE],
  "System": [Permission.SYSTEM_MANAGE],
};
