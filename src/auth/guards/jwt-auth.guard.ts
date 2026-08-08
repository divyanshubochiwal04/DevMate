import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { BaseAuthGuard } from "./base-auth.guard";
import { JwtUtil } from "../utils/jwt.util";
import { UserAuthService } from "../services/user-auth.service";
import { AuthContextService } from "../context/auth-context.service";
import { SKIP_AUTH_KEY } from "../../common/decorators/skip-auth.decorator";

/**
 * JwtAuthGuard — validates access tokens on every request.
 *
 * Registered globally via APP_GUARD. The flow is:
 * 1. Check @SkipAuth() → allow through if present
 * 2. Extract Bearer token from Authorization header
 * 3. Verify token signature + expiry (throws on failure)
 * 4. Load user + RBAC context from DB
 * 5. Attach enriched user to request.user (includes sessionId from `sid` claim)
 * 6. Populate AuthContextService for downstream access
 */
@Injectable()
export class JwtAuthGuard extends BaseAuthGuard {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtUtil: JwtUtil,
    private readonly userAuthService: UserAuthService,
    private readonly authContextService: AuthContextService
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ── 1. Public route bypass ───────────────────────────────────────────────
    const isPublic = this.reflector.getAllAndOverride<boolean>(SKIP_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // ── 2. Extract token ─────────────────────────────────────────────────────
    const request = this.getRequest(context);
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException(
        "Authorization header is missing or malformed. Expected: Bearer <token>"
      );
    }

    // ── 3. Verify token signature + expiry ───────────────────────────────────
    const payload = this.jwtUtil.verifyAccessToken(token); // throws UnauthorizedException on failure

    // ── 4. Load user with RBAC context from DB ───────────────────────────────
    const user = await this.userAuthService.resolveById(payload.sub);

    if (!user) {
      throw new UnauthorizedException(
        "Authenticated user account no longer exists or has been suspended."
      );
    }

    // ── 5. Enrich user with session ID from JWT sid claim ─────────────────────
    // This allows AuthController.logout() to revoke the exact current session
    // without the client needing to send the refresh token.
    const enrichedUser = { ...user, sessionId: payload.sid };

    // ── 6. Attach enriched user to the request object ─────────────────────────
    (request as any).user = enrichedUser;

    // ── 7. Populate AsyncLocalStorage context for downstream services ─────────
    return new Promise((resolve) => {
      this.authContextService.run(enrichedUser, () => resolve(true));
    });
  }
}
