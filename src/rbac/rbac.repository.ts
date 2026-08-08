import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { Role } from "./roles/role.constants";

/**
 * RbacRepository — resolves a user's complete RBAC context from the database.
 *
 * This repository owns the single, authoritative query that loads a user's
 * roles and all inherited permissions in one round-trip.
 */
@Injectable()
export class RbacRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Loads a user with their full role and permission graph.
   * Returns null if the user does not exist or has been soft-deleted.
   */
  async findUserWithRbac(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: {
        userRoles: {
          where: { deletedAt: null },
          include: {
            role: {
              include: {
                rolePermissions: {
                  where: { deletedAt: null },
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    return this.mapToAuthenticatedUser(user);
  }

  /**
   * Resolves roles and permissions for a user identified by Telegram ID.
   */
  async findUserByTelegramIdWithRbac(
    telegramId: bigint
  ): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { telegramId, deletedAt: null },
      include: {
        userRoles: {
          where: { deletedAt: null },
          include: {
            role: {
              include: {
                rolePermissions: {
                  where: { deletedAt: null },
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    return this.mapToAuthenticatedUser(user);
  }

  /**
   * Returns a flat, deduplicated array of permission names for a given user.
   * Aggregated across all roles the user holds.
   */
  async getUserPermissionNames(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId, deletedAt: null },
      include: {
        role: {
          include: {
            rolePermissions: {
              where: { deletedAt: null },
              include: { permission: true },
            },
          },
        },
      },
    });

    const permSet = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permSet.add(rp.permission.name);
      }
    }

    return [...permSet];
  }

  /**
   * Assigns a role to a user (idempotent — uses upsert).
   */
  async assignRoleToUser(userId: string, roleId: string): Promise<void> {
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: { deletedAt: null },
      create: { userId, roleId },
    });
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private mapToAuthenticatedUser(user: any): AuthenticatedUser {
    const roles: string[] = [];
    const permSet = new Set<string>();

    for (const ur of user.userRoles) {
      roles.push(ur.role.name);
      for (const rp of ur.role.rolePermissions) {
        permSet.add(rp.permission.name);
      }
    }

    return {
      id: user.id,
      telegramId: user.telegramId.toString(),
      username: user.username ?? null,
      firstName: user.firstName,
      lastName: user.lastName ?? null,
      status: user.status,
      roles,
      permissions: [...permSet],
      isSuperAdmin: roles.includes(Role.SUPER_ADMIN),
    };
  }
}
