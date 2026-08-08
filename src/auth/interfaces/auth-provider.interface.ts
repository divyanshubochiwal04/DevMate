import { AuthRequestContext } from "./auth-request-context.interface";
import { AuthResult } from "./auth-result.interface";

/**
 * IAuthProvider — the contract every authentication provider must implement.
 *
 * AuthService depends on this abstraction, not on any concrete provider.
 * Adding a new provider (Google, GitHub, etc.) requires:
 *   1. Create a class implementing IAuthProvider
 *   2. Register it in AuthCoreModule under AUTH_PROVIDERS
 *   3. Add a controller endpoint that calls authService.loginWithProvider()
 *
 * Zero changes to AuthService, guards, or any existing logic.
 */
export interface IAuthProvider {
  /**
   * Unique provider identifier.
   * Used to route requests to the correct provider.
   * Examples: 'telegram', 'google', 'github', 'email-otp', 'magic-link'
   */
  readonly providerName: string;

  /**
   * Authenticates the user using provider-specific credentials.
   * Returns the raw DB user and whether this is their first login.
   *
   * @param input  - Provider-specific DTO (TelegramAuthDto, GoogleAuthDto, etc.)
   * @param context - HTTP request context (ip, ua, platform, device)
   */
  authenticate(input: unknown, context: AuthRequestContext): Promise<AuthResult>;
}
