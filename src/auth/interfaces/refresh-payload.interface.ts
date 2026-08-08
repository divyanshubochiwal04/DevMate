/**
 * RefreshPayload — the claims embedded in a refresh token.
 *
 * Contains only what is needed to look up the session record
 * and issue a new token pair. The session ID (jti) enables
 * per-session revocation without invalidating all user tokens.
 */
export interface RefreshPayload {
  /** Subject — the user's UUID */
  sub: string;

  /** JWT Token ID — corresponds to Session.id for revocation */
  jti: string;

  /** Issued-at timestamp */
  iat?: number;

  /** Expiry timestamp */
  exp?: number;
}
