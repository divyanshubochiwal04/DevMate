import { SetMetadata } from "@nestjs/common";
import { RoleKey } from "../../rbac/roles/role.constants";

/** Metadata key used by RolesGuard to read required roles */
export const ROLES_KEY = "devmate:roles";

/**
 * @Roles() — restricts a route to users holding at least one of the listed roles.
 *
 * @example
 * \@Roles(Role.ADMIN, Role.SUPER_ADMIN)
 * \@Get('/admin/users')
 * listAllUsers() { ... }
 */
export const Roles = (...roles: RoleKey[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
