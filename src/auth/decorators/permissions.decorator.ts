import { SetMetadata } from "@nestjs/common";
import { PermissionKey } from "../../rbac/permissions/permission.constants";

/** Metadata key used by PermissionsGuard to read required permissions */
export const PERMISSIONS_KEY = "devmate:permissions";

/**
 * @RequirePermissions() — restricts a route to users holding ALL listed permissions.
 * Super Admin bypasses this check automatically.
 *
 * @example
 * \@RequirePermissions(Permission.USER_READ, Permission.TODO_CREATE)
 * \@Get('/dashboard')
 * getDashboard() { ... }
 */
export const RequirePermissions = (
  ...permissions: PermissionKey[]
): MethodDecorator & ClassDecorator => SetMetadata(PERMISSIONS_KEY, permissions);
