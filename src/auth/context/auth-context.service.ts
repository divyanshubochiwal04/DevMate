import { AsyncLocalStorage } from "async_hooks";
import { Injectable } from "@nestjs/common";
import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";

/**
 * AsyncLocalStorage store for the auth context.
 * Defined at module scope so it survives across the full request lifecycle.
 */
const authStorage = new AsyncLocalStorage<{ user: AuthenticatedUser }>();

/**
 * AuthContextService — makes the authenticated user available anywhere
 * within a request without prop-drilling or additional injections.
 *
 * The JwtAuthGuard populates this context after token verification.
 * Any service can then call `getUser()` without depending on the request object.
 */
@Injectable()
export class AuthContextService {
  /**
   * Runs `fn` within a new async context that carries the given user.
   * Called once per request by JwtAuthGuard.
   */
  run(user: AuthenticatedUser, fn: () => void): void {
    authStorage.run({ user }, fn);
  }

  /**
   * Returns the currently authenticated user for this request context.
   * Returns undefined on unauthenticated (public) routes.
   */
  getUser(): AuthenticatedUser | undefined {
    return authStorage.getStore()?.user;
  }

  /**
   * Returns the authenticated user's UUID.
   * Throws if called outside of an authenticated request context.
   */
  getUserId(): string {
    const user = this.getUser();
    if (!user) {
      throw new Error(
        "AuthContextService.getUserId() called outside of an authenticated request context."
      );
    }
    return user.id;
  }

  /**
   * Returns true if the current request is authenticated.
   */
  isAuthenticated(): boolean {
    return this.getUser() !== undefined;
  }
}
