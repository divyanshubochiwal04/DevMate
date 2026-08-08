import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";
import { RequestWithUser } from "../interfaces/request-with-user.interface";

/**
 * PermissionsGuard — enforces permission-based access control on routes
 * decorated with @RequirePermissions().
 *
 * Execution order: runs AFTER JwtAuthGuard and RolesGuard.
 *
 * Rules:
 * - Routes without @RequirePermissions() are always allowed through
 * - SUPER_ADMIN bypasses all permission checks
 * - User must hold ALL of the listed permissions (AND logic)
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // ── 1. Read required permissions from metadata ────────────────────────────
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );

    // No @RequirePermissions() decorator → allow through
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    // ── 2. Get authenticated user ────────────────────────────────────────────
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user) {
      throw new ForbiddenException(
        "Authentication required to check permissions."
      );
    }

    // ── 3. Super Admin bypass ────────────────────────────────────────────────
    if (user.isSuperAdmin) return true;

    // ── 4. Check all required permissions (AND logic) ─────────────────────────
    const userPermSet = new Set(user.permissions);
    const missingPermissions = requiredPermissions.filter(
      (perm) => !userPermSet.has(perm)
    );

    if (missingPermissions.length > 0) {
      throw new ForbiddenException(
        `Access denied. Missing permission(s): ${missingPermissions.join(", ")}.`
      );
    }

    return true;
  }
}
