import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { AuthUserRepository } from "./repositories/auth-user.repository";
import { SessionRepository } from "./repositories/session.repository";
import { AuthContextService } from "./context/auth-context.service";
import { PasswordService } from "./services/password.service";
import { TokenService } from "./services/token.service";
import { UserAuthService } from "./services/user-auth.service";
import { AuthService } from "./services/auth.service";
import { JwtUtil } from "./utils/jwt.util";

import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { PermissionsGuard } from "./guards/permissions.guard";

import { AUTH_PROVIDERS } from "./providers/auth-provider.token";
import { TelegramProvider } from "./providers/telegram/telegram.provider";
import { TelegramValidator } from "./providers/telegram/telegram.validator";
import { AuthController } from "./controllers/auth.controller";

/**
 * AuthCoreModule — global Identity & Access Foundation module.
 *
 * Provides:
 * - JWT infrastructure (JwtUtil, TokenService)
 * - Password hashing (PasswordService)
 * - User resolution (UserAuthService, AuthUserRepository)
 * - Request context (AuthContextService)
 * - Global guards via APP_GUARD (JwtAuthGuard → RolesGuard → PermissionsGuard)
 * - Authentication services (AuthService, SessionRepository)
 * - Multi-provider configuration (AUTH_PROVIDERS)
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [
    // ── Infrastructure ─────────────────────────────────────────────────────
    JwtUtil,
    AuthContextService,

    // ── Services ───────────────────────────────────────────────────────────
    PasswordService,
    TokenService,
    UserAuthService,
    AuthService,

    // ── Repositories ───────────────────────────────────────────────────────
    AuthUserRepository,
    SessionRepository,

    // ── Auth Providers ─────────────────────────────────────────────────────
    TelegramValidator,
    TelegramProvider,
    {
      provide: AUTH_PROVIDERS,
      useFactory: (telegramProvider: TelegramProvider) => [telegramProvider],
      inject: [TelegramProvider],
    },

    // ── Global Guards (order is significant) ───────────────────────────────
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
  exports: [
    PasswordService,
    TokenService,
    UserAuthService,
    AuthService,
    AuthUserRepository,
    SessionRepository,
    AuthContextService,
    JwtUtil,
    AUTH_PROVIDERS,
  ],
})
export class AuthCoreModule {}
