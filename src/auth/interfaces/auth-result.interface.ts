import { User } from "@prisma/client";

/**
 * AuthResult — the value returned by every IAuthProvider.authenticate() call.
 *
 * Contains the raw Prisma User (newly created or existing)
 * and whether this is the user's first login with this provider.
 *
 * The raw User is then passed to UserAuthService.resolveById() to
 * load the full AuthenticatedUser with RBAC context.
 */
export interface AuthResult {
  /** The Prisma User record, created or updated by the provider */
  user: User;

  /** True if this is the first time this user authenticated */
  isNewUser: boolean;
}
