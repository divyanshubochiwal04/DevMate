/**
 * AuthRequestContext — HTTP request metadata passed to every auth provider.
 *
 * Captured by the controller from the inbound HTTP request and
 * forwarded to the provider and session creation logic.
 * Never logged at DEBUG/INFO level.
 */
export interface AuthRequestContext {
  /** Originating IP address (respects X-Forwarded-For for proxied environments) */
  ipAddress: string | null;

  /** Raw User-Agent header string */
  userAgent: string | null;

  /** Platform sent by the client (e.g. 'ios', 'android', 'web') */
  platform: string | null;

  /** Human-readable device label sent by the client */
  deviceName: string | null;
}
