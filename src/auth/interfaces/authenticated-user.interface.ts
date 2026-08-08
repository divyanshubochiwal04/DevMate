/**
 * AuthenticatedUser — the shape attached to every authenticated request.
 * Constructed by JwtAuthGuard after verifying the token and loading
 * the user's full RBAC context from the database.
 *
 * SECURITY: never contains password hash, refresh tokens, or secrets.
 */
export interface AuthenticatedUser {
  /** User UUID (primary key) */
  id: string;

  /** Telegram ID serialized as string (BigInt cannot be JSON-serialized) */
  telegramId: string;

  /** Telegram username, if available */
  username: string | null;

  /** User's first name */
  firstName: string;

  /** User's last name, if available */
  lastName: string | null;

  /** Account status */
  status: string;

  /** Role names this user holds, e.g. ['SUPER_ADMIN', 'USER'] */
  roles: string[];

  /** Flat, deduplicated list of all permission names inherited through roles */
  permissions: string[];

  /** True if user holds the SUPER_ADMIN role — bypasses all permission checks */
  isSuperAdmin: boolean;

  /**
   * Session UUID from the JWT `sid` claim.
   * Populated by JwtAuthGuard. Used by logout to revoke the current session
   * without requiring the refresh token in the request body.
   * Undefined on unauthenticated (SkipAuth) routes.
   */
  sessionId?: string;
}
