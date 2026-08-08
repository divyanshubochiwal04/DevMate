import { Injectable } from "@nestjs/common";
import { IAuthProvider } from "../../interfaces/auth-provider.interface";
import { AuthResult } from "../../interfaces/auth-result.interface";
import { AuthRequestContext } from "../../interfaces/auth-request-context.interface";
import { TelegramAuthDto } from "../../dto/telegram-auth.dto";
import { TelegramValidator } from "./telegram.validator";
import { AuthUserRepository } from "../../repositories/auth-user.repository";
import { ConfigService } from "../../../config/config.service";

/**
 * TelegramProvider — authenticates users via Telegram Mini App initData.
 *
 * Implements IAuthProvider. AuthService calls this provider when processing
 * POST /auth/telegram requests.
 *
 * Adding another provider (e.g. Google):
 * 1. Create GoogleProvider implements IAuthProvider
 * 2. Register in AuthCoreModule
 * 3. Add POST /auth/google endpoint
 * — No changes here or in AuthService needed.
 */
@Injectable()
export class TelegramProvider implements IAuthProvider {
  readonly providerName = "telegram";

  constructor(
    private readonly validator: TelegramValidator,
    private readonly authUserRepository: AuthUserRepository,
    private readonly configService: ConfigService
  ) {}

  /**
   * Authenticates the user using their Telegram initData.
   *
   * Flow:
   * 1. Validate initData payload (HMAC-SHA256, clock skew, hash)
   * 2. Extract TelegramIdentity
   * 3. Upsert user in DB (create on first login, update profile on subsequent logins)
   * 4. Return raw User + isNewUser flag
   */
  async authenticate(
    input: TelegramAuthDto,
    _context: AuthRequestContext
  ): Promise<AuthResult> {
    // ── 1. Validate and extract identity ─────────────────────────────────────
    const identity = this.validator.validate(
      input.initData,
      this.configService.telegramBotToken
    );

    // ── 2. Upsert user ────────────────────────────────────────────────────────
    const { user, isNewUser } = await this.authUserRepository.upsertByTelegramId(identity);

    return { user, isNewUser };
  }
}
