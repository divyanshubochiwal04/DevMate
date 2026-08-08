import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

/**
 * RoleRepository — database operations for the Role entity.
 * Contains only data access logic; no business rules.
 */
@Injectable()
export class RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns all non-deleted roles with their assigned permissions */
  findAll() {
    return this.prisma.role.findMany({
      where: { deletedAt: null },
      include: {
        rolePermissions: {
          where: { deletedAt: null },
          include: { permission: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  /** Finds a role by its unique name */
  findByName(name: string) {
    return this.prisma.role.findUnique({
      where: { name },
      include: {
        rolePermissions: {
          where: { deletedAt: null },
          include: { permission: true },
        },
      },
    });
  }

  /** Finds a role by its primary key */
  findById(id: string) {
    return this.prisma.role.findUnique({
      where: { id },
    });
  }

  /**
   * Creates or updates a role (idempotent).
   * Safe to call multiple times — will not create duplicates.
   */
  upsert(name: string) {
    return this.prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  /**
   * Assigns a permission to a role (idempotent).
   * Uses the composite PK [roleId, permissionId] for the upsert.
   */
  async assignPermissionToRole(roleId: string, permissionId: string): Promise<void> {
    await this.prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      update: { deletedAt: null },
      create: { roleId, permissionId },
    });
  }
}
