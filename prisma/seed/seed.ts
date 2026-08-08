import "reflect-metadata";
import * as path from "path";
import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { seedPermissions } from "./seeders/permission.seeder";
import { seedRoles } from "./seeders/role.seeder";
import { seedRolePermissions } from "./seeders/role-permission.seeder";
import { seedSuperAdmin } from "./seeders/super-admin.seeder";

// ── Load environment variables before anything else ──────────────────────────
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

/**
 * Main seed function.
 *
 * Execution order matters — permissions must exist before role mappings.
 *
 * 1. Permissions + Groups
 * 2. Roles
 * 3. Role → Permission mappings
 * 4. Super Admin user
 *
 * Every step is idempotent. Run this as many times as needed safely.
 */
async function main(): Promise<void> {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║          DevMate — Database Seed                    ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Cannot seed the database.");
  }

  // ── Initialise Prisma with the pg driver adapter ──────────────────────────
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    await prisma.$connect();
    console.log("✔ Connected to database.\n");

    await seedPermissions(prisma);
    await seedRoles(prisma);
    await seedRolePermissions(prisma);
    await seedSuperAdmin(prisma);

    console.log("\n✅ Seed completed successfully!\n");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err.message);
  process.exit(1);
});
