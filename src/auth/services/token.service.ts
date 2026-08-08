import { Injectable } from "@nestjs/common";
import { JwtUtil } from "../utils/jwt.util";
import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";
import { TokenPair } from "../interfaces/token-pair.interface";
import { JwtPayload } from "../interfaces/jwt-payload.interface";
import { RefreshPayload } from "../interfaces/refresh-payload.interface";

/**
 * TokenService — high-level token generation and decoding.
 *
 * Wraps JwtUtil to provide a semantic API for creating token pairs
 * and decoding tokens. Future auth flows (Telegram, Google, email)
 * all funnel through this service.
 */
@Injectable()
export class TokenService {
  constructor(private readonly jwtUtil: JwtUtil) {}

  /**
   * Generates a fresh access + refresh token pair for the given user.
   *
   * The sessionId is embedded in both tokens:
   * - Access token: `sid` claim — allows logout to identify the current session
   * - Refresh token: `jti` claim — used as Session.id for O(1) DB lookup on refresh
   *
   * @param user      - The authenticated user context
   * @param sessionId - The pre-generated Session UUID
   */
  generateTokenPair(user: AuthenticatedUser, sessionId: string): TokenPair {
    const accessPayload: Omit<JwtPayload, "iat" | "exp"> = {
      sub: user.id,
      tid: user.telegramId,
      roles: user.roles,
      sid: sessionId,
    };

    const refreshPayload: Omit<RefreshPayload, "iat" | "exp"> = {
      sub: user.id,
      jti: sessionId,
    };

    return {
      accessToken: this.jwtUtil.signAccessToken(accessPayload),
      refreshToken: this.jwtUtil.signRefreshToken(refreshPayload),
      accessExpiresIn: this.jwtUtil.getAccessTokenExpiry(),
    };
  }

  /**
   * Verifies and decodes an access token.
   * Throws UnauthorizedException if invalid or expired.
   */
  verifyAccessToken(token: string): JwtPayload {
    return this.jwtUtil.verifyAccessToken(token);
  }

  /**
   * Verifies and decodes a refresh token.
   * Throws UnauthorizedException if invalid or expired.
   */
  verifyRefreshToken(token: string): RefreshPayload {
    return this.jwtUtil.verifyRefreshToken(token);
  }
}
