/**
 * SessionInfo — the safe, sanitized session view returned in API responses.
 *
 * NEVER includes: refreshTokenHash, ipAddress, or any sensitive DB internals.
 */
export interface SessionInfo {
  /** Session UUID */
  id: string;

  /** Platform string sent by client at login (e.g. 'ios', 'android', 'web') */
  platform: string | null;

  /** Human-readable device label */
  deviceName: string | null;

  /** Detected browser (populated by future UA parser) */
  browser: string | null;

  /** Detected OS (populated by future UA parser) */
  os: string | null;

  /** Last time this session was used (login or refresh) */
  lastActivityAt: Date | null;

  /** When the session was created */
  createdAt: Date;

  /** When the refresh token for this session expires */
  expiresAt: Date;
}
