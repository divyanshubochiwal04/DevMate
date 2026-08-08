/**
 * TokenPair — the response shape returned after successful authentication.
 *
 * SECURITY: refresh tokens must never be stored in localStorage.
 * They should be set as httpOnly, Secure, SameSite=Strict cookies.
 */
export interface TokenPair {
  /** Short-lived JWT access token */
  accessToken: string;

  /** Long-lived refresh token (opaque to the client — store in httpOnly cookie) */
  refreshToken: string;

  /** Access token lifetime in seconds (for client-side expiry tracking) */
  accessExpiresIn: number;
}
