import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { Role } from "../../rbac/roles/role.constants";
import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";
import { RequestWithUser } from "../interfaces/request-with-user.interface";

/**
 * RolesGuard — enforces role-based access control on routes decorated with @Roles().
 *
 * Execution order: runs AFTER JwtAuthGuard (request.user is already set).
 *
 * Rules:
 * - Routes without @Roles() are always allowed through
 * - SUPER_ADMIN bypasses all role checks
 * - User must hold AT LEAST ONE of the listed roles
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // ── 1. Read required roles from metadata ─────────────────────────────────
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    // No @Roles() decorator → allow through
    if (!requiredRoles || requiredRoles.length === 0) return true;

    // ── 2. Get authenticated user ────────────────────────────────────────────
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user: AuthenticatedUser | undefined = request.user;

    // If no user (e.g., on a @SkipAuth route that somehow has @Roles) → deny
    if (!user) {
      throw new ForbiddenException("Authentication required to check roles.");
    }

    // ── 3. Super Admin bypass ────────────────────────────────────────────────
    if (user.isSuperAdmin) return true;

    // ── 4. Check role membership ─────────────────────────────────────────────
    const userRoleSet = new Set(user.roles);
    const hasRole = requiredRoles.some((role) => userRoleSet.has(role));

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required role(s): ${requiredRoles.join(", ")}.`
      );
    }

    return true;
  }
}
