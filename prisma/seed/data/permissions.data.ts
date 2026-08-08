import { Permission, PermissionGroups } from "../../../src/rbac/permissions/permission.constants";

/**
 * All permissions to be seeded into the database.
 * Structure matches the PermissionGroups map for grouping.
 */
export const permissionsData: Array<{ name: string; group: string }> = Object.entries(
  PermissionGroups
).flatMap(([group, permissions]) =>
  permissions.map((name) => ({ name, group }))
);
