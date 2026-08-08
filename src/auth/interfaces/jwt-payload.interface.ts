/**
 * JwtPayload — the claims embedded in every access token.
 *
 * SECURITY: keep minimal. No email, no username, no sensitive data.
 * Only the information guards absolutely need to authorize a request.
 */
export interface JwtPayload {
  /** Subject — the user's UUID */
  sub: string;

  /** Telegram ID serialized as string */
  tid: string;

  /** Role names at token issuance time */
  roles: string[];

  /**
   * Session ID — maps to Session.id in the database.
   * Allows JwtAuthGuard to populate request.user.sessionId for
   * per-session logout without needing the refresh token.
   */
  sid?: string;

  /** Issuer (e.g. 'devmate') */
  iss?: string;

  /** Audience (e.g. 'devmate-client') */
  aud?: string | string[];

  /** Issued-at timestamp (Unix seconds) — set by jsonwebtoken */
  iat?: number;

  /** Expiry timestamp (Unix seconds) — set by jsonwebtoken */
  exp?: number;
}
