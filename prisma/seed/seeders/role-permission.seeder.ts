import { PrismaClient } from "@prisma/client";
import { rolePermissionsData } from "../data/role-permissions.data";

/**
 * RolePermissionSeeder — creates the mapping between roles and permissions.
 * Must run AFTER both PermissionSeeder and RoleSeeder complete.
 * Idempotent: uses upsert on the composite PK [roleId, permissionId].
 */
export async function seedRolePermissions(prisma: PrismaClient): Promise<void> {
  console.log("  Seeding role-permission mappings...");

  let totalMapped = 0;

  for (const [roleName, permissionNames] of Object.entries(rolePermissionsData)) {
    // Look up role by name
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      console.warn(`  ⚠ Role "${roleName}" not found — skipping permissions.`);
      continue;
    }

    for (const permName of permissionNames) {
      // Look up permission by name
      const permission = await prisma.permission.findUnique({ where: { name: permName } });
      if (!permission) {
        console.warn(`  ⚠ Permission "${permName}" not found — skipping.`);
        continue;
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: { deletedAt: null },
        create: { roleId: role.id, permissionId: permission.id },
      });

      totalMapped++;
    }
  }

  console.log(`  ✔ ${totalMapped} role-permission mappings seeded.`);
}
