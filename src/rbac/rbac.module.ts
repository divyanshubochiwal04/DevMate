import { Global, Module } from "@nestjs/common";
import { RbacRepository } from "./rbac.repository";
import { PermissionRepository } from "./permissions/permission.repository";
import { RoleRepository } from "./roles/role.repository";

/**
 * RbacModule — global module providing all RBAC data access repositories.
 *
 * Marked as @Global() so that RbacRepository, PermissionRepository,
 * and RoleRepository are available to any module without re-importing.
 *
 * This module has no circular dependencies — it only imports PrismaModule
 * (which is itself global).
 */
@Global()
@Module({
  providers: [RbacRepository, PermissionRepository, RoleRepository],
  exports: [RbacRepository, PermissionRepository, RoleRepository],
})
export class RbacModule {}
