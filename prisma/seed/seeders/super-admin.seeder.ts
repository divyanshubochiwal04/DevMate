import { PrismaClient } from "@prisma/client";

/**
 * SuperAdminSeeder — creates the default Super Admin user.
 *
 * Reads SUPER_ADMIN_TELEGRAM_ID from the environment.
 * Idempotent: uses upsert; will not duplicate the user if run multiple times.
 *
 * This does NOT hash any password — the User model authenticates via Telegram.
 */
export async function seedSuperAdmin(prisma: PrismaClient): Promise<void> {
  console.log("  Seeding Super Admin user...");

  const telegramIdStr = process.env.SUPER_ADMIN_TELEGRAM_ID;
  if (!telegramIdStr) {
    console.warn(
      "  ⚠ SUPER_ADMIN_TELEGRAM_ID not set — skipping Super Admin seed."
    );
    return;
  }

  const telegramId = BigInt(telegramIdStr);

  // ── 1. Upsert the Super Admin user ──────────────────────────────────────
  const superAdminUser = await prisma.user.upsert({
    where: { telegramId },
    update: {}, // Don't override data if user already exists
    create: {
      telegramId,
      firstName: "Super Admin",
      username: "superadmin",
      status: "ACTIVE",
    },
  });

  // ── 2. Fetch the SUPER_ADMIN role ────────────────────────────────────────
  const superAdminRole = await prisma.role.findUnique({
    where: { name: "SUPER_ADMIN" },
  });

  if (!superAdminRole) {
    console.warn(
      "  ⚠ SUPER_ADMIN role not found — did the role seeder run first?"
    );
    return;
  }

  // ── 3. Assign the SUPER_ADMIN role (idempotent) ──────────────────────────
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: superAdminUser.id,
        roleId: superAdminRole.id,
      },
    },
    update: { deletedAt: null },
    create: {
      userId: superAdminUser.id,
      roleId: superAdminRole.id,
    },
  });

  console.log(
    `  ✔ Super Admin seeded: telegramId=${telegramId}, userId=${superAdminUser.id}`
  );
}
