import { SetMetadata } from "@nestjs/common";

export const BYPASS_TRANSFORM_KEY = "bypassTransform";

/**
 * Decorator to bypass the global response transform interceptor.
 * Useful for endpoints that need to return raw payloads (e.g. Health checks, OAuth redirects, file downloads).
 */
export const BypassTransform = () => SetMetadata(BYPASS_TRANSFORM_KEY, true);
