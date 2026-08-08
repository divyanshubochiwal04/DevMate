import { Injectable } from "@nestjs/common";
import { Session } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

/**
 * Data required to create a new session record.
 * The caller provides all fields; no defaults are inferred here.
 */
export interface CreateSessionData {
  /** Explicitly provided UUID — same value used as JWT refresh token `jti` */
  id: string;
  userId: string;
  /** SHA-256 hex hash of the raw refresh token — NEVER store the raw token */
  refreshTokenHash: string;
  ipAddress: string | null;
  userAgent: string | null;
  platform: string | null;
  deviceName: string | null;
  browser?: string | null;
  os?: string | null;
  expiresAt: Date;
}

/**
 * SessionRepository — all database operations for the Session entity.
 *
 * Security rules enforced here:
 * - Raw refresh tokens are never accepted or stored
 * - Only SHA-256 hashes are written to the DB
 * - Revocation sets revokedAt; it never deletes rows (audit trail)
 */
@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new session record with the given pre-hashed refresh token.
   */
  async create(data: CreateSessionData): Promise<Session> {
    return this.prisma.session.create({
      data: {
        id: data.id,
        userId: data.userId,
        refreshTokenHash: data.refreshTokenHash,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        platform: data.platform,
        deviceName: data.deviceName,
        browser: data.browser ?? null,
        os: data.os ?? null,
        expiresAt: data.expiresAt,
        lastActivityAt: new Date(),
      },
    });
  }

  /**
   * Finds a session by its primary key (= JWT refresh token `jti`).
   * Returns null if not found.
   */
  async findById(id: string): Promise<Session | null> {
    return this.prisma.session.findUnique({
      where: { id },
    });
  }

  /**
   * Returns all active (non-revoked, non-expired, non-deleted) sessions for a user.
   * Ordered by most recently active first.
   */
  async findActiveByUserId(userId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        deletedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActivityAt: "desc" },
    });
  }

  /**
   * Updates the lastActivityAt timestamp for a session.
   * Called after successful token refresh.
   */
  async updateActivity(id: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id, revokedAt: null },
      data: { lastActivityAt: new Date() },
    });
  }

  /**
   * Revokes a single session by setting revokedAt.
   * Idempotent — safe to call on an already-revoked session.
   */
  async revoke(id: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revokes ALL active sessions for a user.
   * Called on:
   *  - Logout all devices
   *  - Refresh token reuse detection (security incident response)
   */
  async revokeAllByUserId(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Soft-deletes expired sessions for a user.
   * Intended to be called periodically by a background cleanup job.
   */
  async deleteExpiredByUserId(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        userId,
        expiresAt: { lt: new Date() },
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
  }
}
