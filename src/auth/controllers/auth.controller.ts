import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { Request } from "express";

import { AuthService } from "../services/auth.service";
import { TelegramAuthDto } from "../dto/telegram-auth.dto";
import { RefreshTokenDto } from "../dto/refresh-token.dto";
import { LogoutDto } from "../dto/logout.dto";
import { AuthRequestContext } from "../interfaces/auth-request-context.interface";
import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";
import { SkipAuth } from "../../common/decorators/skip-auth.decorator";
import { CurrentUser } from "../decorators/current-user.decorator";

/**
 * AuthController — authentication endpoints.
 *
 * All responses are wrapped by TransformInterceptor (StandardResponse envelope).
 * Guards registered via APP_GUARD apply globally. SkipAuth disables JWT check.
 *
 * Route summary:
 *   POST /auth/telegram   — Telegram Mini App login     [@SkipAuth]
 *   POST /auth/refresh    — Rotate refresh token        [@SkipAuth]
 *   POST /auth/logout     — Revoke session(s)           [JWT Required]
 *   GET  /auth/me         — Current user profile        [JWT Required]
 */
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── POST /auth/telegram ──────────────────────────────────────────────────

  /**
   * Telegram Mini App login.
   * Verifies initData, creates/updates user, creates session, returns token pair.
   */
  @Post("telegram")
  @SkipAuth()
  @HttpCode(HttpStatus.OK)
  async loginWithTelegram(
    @Body() dto: TelegramAuthDto,
    @Req() req: Request
  ) {
    const ctx = this.buildAuthContext(req, dto.platform, dto.deviceName);
    return this.authService.loginWithTelegram(dto, ctx);
  }

  // ── POST /auth/refresh ───────────────────────────────────────────────────

  /**
   * Rotates the refresh token.
   * Old token is invalidated. Reuse triggers full session revocation.
   */
  @Post("refresh")
  @SkipAuth()
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request
  ) {
    const ctx = this.buildAuthContext(req);
    return this.authService.refresh(dto, ctx);
  }

  // ── POST /auth/logout ────────────────────────────────────────────────────

  /**
   * Logs out the current session, or all sessions when allDevices=true.
   * Requires a valid access token (JWT guard applies).
   */
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @Body() dto: LogoutDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.authService.logout(
      user.id,
      user.sessionId,
      dto.allDevices ?? false
    );
  }

  // ── GET /auth/me ─────────────────────────────────────────────────────────

  /**
   * Returns the current user's profile, roles, permissions, and active sessions.
   * Never exposes tokens, hashes, or sensitive session metadata.
   */
  @Get("me")
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /**
   * Extracts HTTP request metadata for session creation.
   * Respects X-Forwarded-For for proxied environments.
   * NEVER logs IP or UA — passed only to the DB session record.
   */
  private buildAuthContext(
    req: Request,
    platform?: string,
    deviceName?: string
  ): AuthRequestContext {
    const forwarded = req.headers["x-forwarded-for"];
    const ipAddress =
      typeof forwarded === "string"
        ? forwarded.split(",")[0].trim()
        : req.ip ?? null;

    return {
      ipAddress,
      userAgent: req.headers["user-agent"] ?? null,
      platform: platform ?? null,
      deviceName: deviceName ?? null,
    };
  }
}
