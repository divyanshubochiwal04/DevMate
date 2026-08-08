import { SetMetadata } from "@nestjs/common";

/** Metadata key used by JwtAuthGuard to identify public routes */
export const SKIP_AUTH_KEY = "devmate:skip_auth";

/**
 * @SkipAuth() — marks a route as publicly accessible.
 * JwtAuthGuard will allow the request through without token validation.
 *
 * @example
 * \@SkipAuth()
 * \@Get('/health')
 * healthCheck() { ... }
 */
export const SkipAuth = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_AUTH_KEY, true);
