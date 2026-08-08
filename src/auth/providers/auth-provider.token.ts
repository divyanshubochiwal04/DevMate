/**
 * AUTH_PROVIDERS — DI injection token for the array of IAuthProvider implementations.
 *
 * Used in AuthCoreModule to register providers via a factory,
 * and in AuthService to receive the full provider array via @Inject().
 *
 * Adding a new provider:
 * 1. Create the provider class (e.g. GoogleProvider implements IAuthProvider)
 * 2. Add it to the AuthCoreModule factory (useFactory + inject array)
 * 3. Add a new controller endpoint that calls authService.loginWithProvider('google', dto, ctx)
 */
export const AUTH_PROVIDERS = "AUTH_PROVIDERS";
