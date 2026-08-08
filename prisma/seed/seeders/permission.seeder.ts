import { PrismaClient } from "@prisma/client";
import { permissionsData } from "../data/permissions.data";

/**
 * PermissionSeeder — seeds all permission groups and permissions.
 * Idempotent: uses upsert; safe to run multiple times.
 */
export async function seedPermissions(prisma: PrismaClient): Promise<void> {
  console.log("  Seeding permission groups and permissions...");

  // ── 1. Collect unique group names ────────────────────────────────────────
  const groupNames = [...new Set(permissionsData.map((p) => p.group))];

  // ── 2. Upsert all permission groups ──────────────────────────────────────
  const groupMap = new Map<string, string>();
  for (const name of groupNames) {
    const group = await prisma.permissionGroup.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    groupMap.set(name, group.id);
  }

  // ── 3. Upsert all permissions ─────────────────────────────────────────────
  let created = 0;
  for (const { name, group } of permissionsData) {
    const groupId = groupMap.get(group) ?? null;
    await prisma.permission.upsert({
      where: { name },
      update: { groupId },
      create: { name, groupId },
    });
    created++;
  }

  console.log(`  ✔ ${groupNames.length} permission groups, ${created} permissions seeded.`);
}
