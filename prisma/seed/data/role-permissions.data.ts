import { Permission, PermissionKey } from "../../../src/rbac/permissions/permission.constants";
import { Role, RoleKey } from "../../../src/rbac/roles/role.constants";

/**
 * All permission strings as an array for convenience.
 */
const ALL_PERMISSIONS = Object.values(Permission) as PermissionKey[];

/**
 * Permissions excluded from ADMIN role (super admin only).
 */
const ADMIN_EXCLUDED: PermissionKey[] = [
  Permission.SYSTEM_MANAGE,
];

/**
 * Permissions for a standard USER role (own-resource CRUD only).
 * Excludes admin, system, and user-management capabilities.
 */
const USER_PERMISSIONS: PermissionKey[] = [
  Permission.TODO_CREATE, Permission.TODO_READ, Permission.TODO_UPDATE, Permission.TODO_DELETE,
  Permission.REMINDER_CREATE, Permission.REMINDER_READ, Permission.REMINDER_UPDATE, Permission.REMINDER_DELETE,
  Permission.GOAL_CREATE, Permission.GOAL_READ, Permission.GOAL_UPDATE, Permission.GOAL_DELETE,
  Permission.EXPENSE_CREATE, Permission.EXPENSE_READ, Permission.EXPENSE_UPDATE, Permission.EXPENSE_DELETE,
  Permission.LOAN_CREATE, Permission.LOAN_READ, Permission.LOAN_UPDATE, Permission.LOAN_DELETE,
  Permission.SUBSCRIPTION_CREATE, Permission.SUBSCRIPTION_READ, Permission.SUBSCRIPTION_UPDATE, Permission.SUBSCRIPTION_DELETE,
  Permission.BUDGET_CREATE, Permission.BUDGET_READ, Permission.BUDGET_UPDATE, Permission.BUDGET_DELETE,
  Permission.SPLITTER_CREATE, Permission.SPLITTER_READ, Permission.SPLITTER_UPDATE, Permission.SPLITTER_DELETE,
  Permission.NOTE_CREATE, Permission.NOTE_READ, Permission.NOTE_UPDATE, Permission.NOTE_DELETE,
  Permission.VAULT_UPLOAD, Permission.VAULT_DOWNLOAD, Permission.VAULT_UPDATE, Permission.VAULT_DELETE,
  Permission.CALENDAR_CREATE, Permission.CALENDAR_READ, Permission.CALENDAR_UPDATE, Permission.CALENDAR_DELETE,
  Permission.BIRTHDAY_CREATE, Permission.BIRTHDAY_READ, Permission.BIRTHDAY_UPDATE, Permission.BIRTHDAY_DELETE,
  Permission.NOTIFICATION_READ,
  Permission.AI_USE,
  Permission.USER_READ, Permission.USER_UPDATE, // own profile only — enforced at service layer
];

/**
 * Role → Permission mapping matrix.
 * The seeder iterates this to create RolePermission records.
 */
export const rolePermissionsData: Record<RoleKey, PermissionKey[]> = {
  [Role.SUPER_ADMIN]: ALL_PERMISSIONS,
  [Role.ADMIN]: ALL_PERMISSIONS.filter((p) => !ADMIN_EXCLUDED.includes(p)),
  [Role.USER]: USER_PERMISSIONS,
};
