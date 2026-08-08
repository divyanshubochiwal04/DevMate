import { Injectable } from "@nestjs/common";
import { AuthUserRepository } from "../repositories/auth-user.repository";
import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";

/**
 * UserAuthService — user identity resolution for the auth layer.
 *
 * This service provides the bridge between incoming auth credentials
 * (Telegram ID, user UUID from JWT) and the fully resolved
 * AuthenticatedUser context. It contains NO auth logic itself —
 * that belongs to the specific auth strategy (Telegram, Google, etc.)
 * which will be implemented in the next task.
 *
 * Controllers must NEVER call this service directly.
 * Guards and future auth strategies use it.
 */
@Injectable()
export class UserAuthService {
  constructor(private readonly authUserRepository: AuthUserRepository) {}

  /**
   * Resolves a user by their UUID with full RBAC context.
   * Used by JwtAuthGuard to hydrate request.user from the JWT sub claim.
   */
  async resolveById(id: string): Promise<AuthenticatedUser | null> {
    return this.authUserRepository.findByIdWithRbac(id);
  }

  /**
   * Resolves a user by their Telegram ID with full RBAC context.
   * Used during Telegram bot authentication flows.
   */
  async resolveByTelegramId(
    telegramId: bigint
  ): Promise<AuthenticatedUser | null> {
    return this.authUserRepository.findByTelegramIdWithRbac(telegramId);
  }
}
