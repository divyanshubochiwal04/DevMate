import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

/**
 * PermissionRepository — database operations for the Permission entity.
 * Contains only data access logic; no business rules.
 */
@Injectable()
export class PermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns all permissions with their group */
  findAll() {
    return this.prisma.permission.findMany({
      where: { deletedAt: null },
      include: { group: true },
      orderBy: { name: "asc" },
    });
  }

  /** Finds a permission by its unique name */
  findByName(name: string) {
    return this.prisma.permission.findUnique({
      where: { name },
    });
  }

  /** Finds a permission group by its unique name */
  findGroupByName(name: string) {
    return this.prisma.permissionGroup.findUnique({ where: { name } });
  }

  /**
   * Creates or updates a permission group (idempotent).
   * Used by the seed to ensure groups exist before permissions.
   */
  upsertGroup(name: string) {
    return this.prisma.permissionGroup.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  /**
   * Creates or updates a permission (idempotent).
   * Safe to call multiple times — will not create duplicates.
   */
  upsert(name: string, groupId: string | null = null) {
    return this.prisma.permission.upsert({
      where: { name },
      update: { groupId },
      create: { name, groupId },
    });
  }
}
