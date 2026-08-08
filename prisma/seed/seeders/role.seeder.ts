import { PrismaClient } from "@prisma/client";
import { rolesData } from "../data/roles.data";

/**
 * RoleSeeder — seeds all application roles.
 * Idempotent: uses upsert; safe to run multiple times.
 */
export async function seedRoles(prisma: PrismaClient): Promise<void> {
  console.log("  Seeding roles...");

  for (const { name } of rolesData) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log(`  ✔ ${rolesData.length} roles seeded.`);
}
