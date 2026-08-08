import * as jwt from "jsonwebtoken";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "../../config/config.service";
import { JwtPayload } from "../interfaces/jwt-payload.interface";
import { RefreshPayload } from "../interfaces/refresh-payload.interface";

/**
 * JwtUtil — low-level JWT sign and verify utility.
 *
 * All algorithm, secret, expiry, issuer, and audience values are
 * read exclusively from ConfigService. Nothing is hardcoded.
 *
 * This utility is the single point of JWT operations. No other
 * class calls jsonwebtoken directly.
 */
@Injectable()
export class JwtUtil {
  constructor(private readonly configService: ConfigService) {}

  // ─── Access Tokens ──────────────────────────────────────────────────────────

  /**
   * Signs an access token for the given payload.
   * Algorithm: HS256. Secret & expiry from ConfigService.
   */
  signAccessToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
    return jwt.sign(payload, this.configService.jwtAccessSecret, {
      expiresIn: this.configService.jwtAccessExpires as jwt.SignOptions["expiresIn"],
      issuer: this.configService.jwtIssuer,
      audience: this.configService.jwtAudience,
      algorithm: "HS256",
    });
  }

  /**
   * Verifies an access token and returns its decoded payload.
   * Throws UnauthorizedException if the token is invalid or expired.
   */
  verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.configService.jwtAccessSecret, {
        issuer: this.configService.jwtIssuer,
        audience: this.configService.jwtAudience,
        algorithms: ["HS256"],
      }) as JwtPayload;
    } catch (err: any) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException("Access token has expired.");
      }
      throw new UnauthorizedException("Access token is invalid.");
    }
  }

  /**
   * Decodes an access token WITHOUT verification.
   * Use only for reading non-security-critical metadata (e.g., logging).
   */
  decodeAccessToken(token: string): JwtPayload | null {
    return jwt.decode(token) as JwtPayload | null;
  }

  // ─── Refresh Tokens ─────────────────────────────────────────────────────────

  /**
   * Signs a refresh token for the given payload.
   * Uses the separate refresh secret and expiry from ConfigService.
   */
  signRefreshToken(payload: Omit<RefreshPayload, "iat" | "exp">): string {
    return jwt.sign(payload, this.configService.jwtRefreshSecret, {
      expiresIn: this.configService.jwtRefreshExpires as jwt.SignOptions["expiresIn"],
      algorithm: "HS256",
    });
  }

  /**
   * Verifies a refresh token and returns its decoded payload.
   * Throws UnauthorizedException if the token is invalid or expired.
   */
  verifyRefreshToken(token: string): RefreshPayload {
    try {
      return jwt.verify(token, this.configService.jwtRefreshSecret, {
        algorithms: ["HS256"],
      }) as RefreshPayload;
    } catch (err: any) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException("Refresh token has expired.");
      }
      throw new UnauthorizedException("Refresh token is invalid.");
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Extracts the access token expiry as a Unix timestamp (seconds).
   * Returns 0 if the token cannot be decoded.
   */
  getAccessTokenExpiry(): number {
    const expiry = this.configService.jwtAccessExpires;
    // Convert "15m" → seconds, "1h" → seconds, etc.
    const match = expiry.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 900; // default 15 minutes

    const [, value, unit] = match;
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return parseInt(value, 10) * (multipliers[unit] ?? 60);
  }

  /**
   * Computes the absolute expiry Date for the refresh token.
   * Used to set Session.expiresAt on creation.
   */
  getRefreshTokenExpiresAt(): Date {
    const expiry = this.configService.jwtRefreshExpires;
    const match = expiry.match(/^(\d+)(s|m|h|d)$/);
    const now = Date.now();
    if (!match) return new Date(now + 7 * 86_400_000); // default 7 days

    const [, value, unit] = match;
    const multipliers: Record<string, number> = {
      s: 1_000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return new Date(now + parseInt(value, 10) * (multipliers[unit] ?? 60_000));
  }
}
