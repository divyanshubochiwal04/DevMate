import { Injectable } from "@nestjs/common";
import { User } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { RbacRepository } from "../../rbac/rbac.repository";
import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";
import { TelegramIdentity } from "../interfaces/telegram-identity.interface";

/**
 * AuthUserRepository — database access layer for user identity lookups
 * and provider-driven user creation.
 *
 * Bridges the auth layer and the database. All queries in this
 * repository return the full RBAC-enriched AuthenticatedUser context
 * needed by guards and the request lifecycle.
 *
 * Controllers must NEVER use this repository directly.
 */
@Injectable()
export class AuthUserRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacRepository: RbacRepository
  ) {}

  // ─── RBAC-enriched lookups ───────────────────────────────────────────────

  async findByIdWithRbac(id: string): Promise<AuthenticatedUser | null> {
    return this.rbacRepository.findUserWithRbac(id);
  }

  async findByTelegramIdWithRbac(
    telegramId: bigint
  ): Promise<AuthenticatedUser | null> {
    return this.rbacRepository.findUserByTelegramIdWithRbac(telegramId);
  }

  // ─── Provider-driven upsert ──────────────────────────────────────────────

  /**
   * Creates or updates a user from a verified Telegram identity.
   *
   * First login:  creates user (ACTIVE), assigns USER role.
   * Returning:    updates firstName, lastName, username, profilePhoto, lastLogin.
   */
  async upsertByTelegramId(
    identity: TelegramIdentity
  ): Promise<{ user: User; isNewUser: boolean }> {
    const existing = await this.prisma.user.findUnique({
      where: { telegramId: identity.id },
    });

    if (existing) {
      const updated = await this.prisma.user.update({
        where: { telegramId: identity.id },
        data: {
          firstName: identity.firstName,
          ...(identity.lastName !== undefined && { lastName: identity.lastName }),
          ...(identity.username !== undefined && { username: identity.username }),
          ...(identity.photoUrl !== undefined && { profilePhoto: identity.photoUrl }),
          lastLogin: new Date(),
        },
      });
      return { user: updated, isNewUser: false };
    }

    const userRole = await this.prisma.role.findUnique({ where: { name: "USER" } });

    const created = await this.prisma.user.create({
      data: {
        telegramId: identity.id,
        firstName: identity.firstName,
        lastName: identity.lastName ?? null,
        username: identity.username ?? null,
        profilePhoto: identity.photoUrl ?? null,
        status: "ACTIVE",
        lastLogin: new Date(),
        ...(userRole && {
          userRoles: {
            create: { roleId: userRole.id },
          },
        }),
      },
    });

    return { user: created, isNewUser: true };
  }

  // ─── Utility lookups ─────────────────────────────────────────────────────

  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { id, deletedAt: null },
    });
    return count > 0;
  }

  findRawById(id: string) {
    return this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
        status: true,
        email: true,
        createdAt: true,
      },
    });
  }
}
