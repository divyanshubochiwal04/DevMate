import { SessionInfo } from "./session-info.interface";

/**
 * UserProfile — the user data included in auth responses.
 * NEVER includes: passwords, hashes, tokens, or internal IDs.
 */
export interface UserProfile {
  id: string;
  telegramId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  status: string;
  roles: string[];
  permissions: string[];
}

/**
 * SessionSummary — the session data included in auth responses.
 * Subset of SessionInfo, safe for transmission.
 */
export interface SessionSummary {
  id: string;
  platform: string | null;
  deviceName: string | null;
  createdAt: string;
  expiresAt: string;
}

/**
 * AuthResponse — the data payload for successful login/refresh responses.
 * Wrapped by StandardResponse envelope from TransformInterceptor.
 */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  isNewUser: boolean;
  user: UserProfile;
  session: SessionSummary;
}

/**
 * MeResponse — the data payload for GET /auth/me.
 */
export interface MeResponse {
  user: UserProfile;
  sessions: SessionInfo[];
}

/**
 * LogoutResponse — the data payload for logout.
 */
export interface LogoutResponse {
  message: string;
}
