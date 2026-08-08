import { Injectable, Inject, UnauthorizedException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Session } from "@prisma/client";

import { IAuthProvider } from "../interfaces/auth-provider.interface";
import { AuthRequestContext } from "../interfaces/auth-request-context.interface";
import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";
import {
  AuthResponse,
  MeResponse,
  LogoutResponse,
} from "../interfaces/auth-response.interface";

import { AUTH_PROVIDERS } from "../providers/auth-provider.token";
import { TelegramAuthDto } from "../dto/telegram-auth.dto";
import { RefreshTokenDto } from "../dto/refresh-token.dto";

import { UserAuthService } from "./user-auth.service";
import { TokenService } from "./token.service";
import { SessionRepository } from "../repositories/session.repository";
import { JwtUtil } from "../utils/jwt.util";
import { hashToken, safeCompareTokenHash } from "../utils/token-hash.util";

/**
 * AuthService — the central auth orchestrator.
 *
 * Coordinates:
 * - Provider lookup and authentication
 * - Session lifecycle (create, rotate, revoke)
 * - Token generation and refresh rotation
 * - Security incident response (reuse detection → full revocation)
 *
 * This service is provider-agnostic. Adding Google/GitHub/email
 * requires zero changes here — only a new provider + endpoint.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_PROVIDERS) private readonly providers: IAuthProvider[],
    private readonly userAuthService: UserAuthService,
    private readonly sessionRepository: SessionRepository,
    private readonly tokenService: TokenService,
    private readonly jwtUtil: JwtUtil
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Authenticates a user via Telegram initData.
   * Creates a session and returns a token pair.
   */
  async loginWithTelegram(
    dto: TelegramAuthDto,
    ctx: AuthRequestContext
  ): Promise<AuthResponse> {
    return this.loginWithProvider("telegram", dto, ctx);
  }

  /**
   * Rotates a refresh token: old token is invalidated, new pair is issued.
   *
   * Security: detects token reuse and revokes ALL sessions on compromise.
   */
  async refresh(
    dto: RefreshTokenDto,
    ctx: AuthRequestContext
  ): Promise<AuthResponse> {
    // ── 1. Verify refresh token JWT signature + expiry ────────────────────
    const payload = this.tokenService.verifyRefreshToken(dto.refreshToken);

    if (!payload.jti) {
      throw new UnauthorizedException("Invalid refresh token: missing session ID.");
    }

    // ── 2. Load session by jti (= Session.id) ─────────────────────────────
    const session = await this.sessionRepository.findById(payload.jti);

    if (!session) {
      throw new UnauthorizedException("Session not found or has been revoked.");
    }

    // ── 3. Validate session integrity ─────────────────────────────────────
    if (session.userId !== payload.sub) {
      throw new UnauthorizedException("Token-session mismatch detected.");
    }
    if (session.revokedAt !== null) {
      throw new UnauthorizedException("Session has been revoked.");
    }
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException("Session has expired.");
    }

    // ── 4. Refresh token reuse detection (OWASP RT-09) ────────────────────
    const incomingHash = hashToken(dto.refreshToken);
    if (!safeCompareTokenHash(incomingHash, session.refreshTokenHash)) {
      // SECURITY INCIDENT: token reuse detected — revoke everything
      await this.sessionRepository.revokeAllByUserId(session.userId);
      throw new UnauthorizedException(
        "Refresh token reuse detected. All sessions have been revoked. Please log in again."
      );
    }

    // ── 5. Revoke the consumed session ────────────────────────────────────
    await this.sessionRepository.revoke(session.id);

    // ── 6. Load fresh user with RBAC ──────────────────────────────────────
    const user = await this.userAuthService.resolveById(payload.sub);
    if (!user) {
      throw new UnauthorizedException("User account is unavailable.");
    }

    // ── 7. Create new session + token pair ────────────────────────────────
    const newSessionId = randomUUID();
    const tokens = this.tokenService.generateTokenPair(user, newSessionId);
    const newHash = hashToken(tokens.refreshToken);
    const expiresAt = this.jwtUtil.getRefreshTokenExpiresAt();

    const newSession = await this.sessionRepository.create({
      id: newSessionId,
      userId: user.id,
      refreshTokenHash: newHash,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent ?? session.userAgent,
      platform: session.platform,
      deviceName: session.deviceName,
      browser: session.browser,
      os: session.os,
      expiresAt,
    });

    return this.buildAuthResponse(tokens, user, newSession, false);
  }

  /**
   * Logs out the current session or all sessions for the user.
   *
   * @param userId    - From request.user (JWT claim)
   * @param sessionId - From request.user.sessionId (JWT `sid` claim)
   * @param allDevices - If true, revokes all sessions
   */
  async logout(
    userId: string,
    sessionId: string | undefined,
    allDevices: boolean
  ): Promise<LogoutResponse> {
    if (allDevices) {
      await this.sessionRepository.revokeAllByUserId(userId);
      return { message: "Successfully logged out of all devices." };
    }

    if (sessionId) {
      await this.sessionRepository.revoke(sessionId);
    }

    return { message: "Successfully logged out." };
  }

  /**
   * Returns the current user's profile, roles, permissions, and active sessions.
   * Never exposes tokens, hashes, or IP addresses.
   */
  async getMe(user: AuthenticatedUser): Promise<MeResponse> {
    const sessions = await this.sessionRepository.findActiveByUserId(user.id);

    return {
      user: {
        id: user.id,
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName ?? null,
        username: user.username,
        status: user.status,
        roles: user.roles,
        permissions: user.permissions,
      },
      sessions: sessions.map((s) => ({
        id: s.id,
        platform: s.platform,
        deviceName: s.deviceName,
        browser: s.browser,
        os: s.os,
        lastActivityAt: s.lastActivityAt,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /**
   * Generic login flow used by all providers.
   * Finds the provider → authenticates → creates session → issues tokens.
   */
  private async loginWithProvider(
    providerName: string,
    input: unknown,
    ctx: AuthRequestContext
  ): Promise<AuthResponse> {
    // ── 1. Resolve provider ───────────────────────────────────────────────
    const provider = this.findProvider(providerName);

    // ── 2. Authenticate with provider ─────────────────────────────────────
    const { user: rawUser, isNewUser } = await provider.authenticate(input, ctx);

    // ── 3. Load full RBAC context ─────────────────────────────────────────
    const user = await this.userAuthService.resolveById(rawUser.id);
    if (!user) {
      throw new UnauthorizedException("User account is unavailable.");
    }

    // ── 4. Generate session + tokens ──────────────────────────────────────
    const sessionId = randomUUID();
    const tokens = this.tokenService.generateTokenPair(user, sessionId);
    const refreshHash = hashToken(tokens.refreshToken);
    const expiresAt = this.jwtUtil.getRefreshTokenExpiresAt();

    const session = await this.sessionRepository.create({
      id: sessionId,
      userId: rawUser.id,
      refreshTokenHash: refreshHash,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      platform: ctx.platform,
      deviceName: ctx.deviceName,
      expiresAt,
    });

    return this.buildAuthResponse(tokens, user, session, isNewUser);
  }

  /**
   * Finds an auth provider by name.
   * Throws UnauthorizedException if the provider isn't registered.
   */
  private findProvider(name: string): IAuthProvider {
    const provider = this.providers.find((p) => p.providerName === name);
    if (!provider) {
      throw new UnauthorizedException(
        `Authentication provider '${name}' is not configured.`
      );
    }
    return provider;
  }

  /**
   * Builds the standard auth response payload.
   * NEVER includes: refreshTokenHash, ipAddress, passwords, or secrets.
   */
  private buildAuthResponse(
    tokens: { accessToken: string; refreshToken: string; accessExpiresIn: number },
    user: AuthenticatedUser,
    session: Session,
    isNewUser: boolean
  ): AuthResponse {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.accessExpiresIn,
      isNewUser,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName ?? null,
        username: user.username,
        status: user.status,
        roles: user.roles,
        permissions: user.permissions,
      },
      session: {
        id: session.id,
        platform: session.platform,
        deviceName: session.deviceName,
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
      },
    };
  }
}
