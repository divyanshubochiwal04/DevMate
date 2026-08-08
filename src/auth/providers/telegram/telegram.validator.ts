import { createHmac, timingSafeEqual } from "crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { TelegramIdentity } from "../../interfaces/telegram-identity.interface";

/**
 * TelegramValidator — verifies Telegram Mini App initData payloads.
 *
 * Implements the official Telegram WebApp data validation algorithm:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Security properties:
 * - HMAC-SHA256 using a derived secret key (not the raw bot token)
 * - Constant-time comparison (timingSafeEqual) to prevent timing attacks
 * - auth_date clock skew validation to prevent replay attacks
 */
@Injectable()
export class TelegramValidator {
  /**
   * Validates the Telegram initData string and extracts the user identity.
   *
   * @param initData     - Raw initData string from window.Telegram.WebApp.initData
   * @param botToken     - The Telegram bot token (from ConfigService)
   * @param maxAgeSecs   - Maximum age of auth_date in seconds (default: 300 = 5 minutes)
   * @throws UnauthorizedException on any validation failure
   */
  validate(
    initData: string,
    botToken: string,
    maxAgeSecs = 300
  ): TelegramIdentity {
    if (!initData || !botToken) {
      throw new UnauthorizedException("Invalid Telegram authentication payload.");
    }

    // ── 1. Parse URL-encoded initData ────────────────────────────────────────
    let params: URLSearchParams;
    try {
      params = new URLSearchParams(initData);
    } catch {
      throw new UnauthorizedException("Malformed Telegram initData.");
    }

    // ── 2. Extract and remove the hash ───────────────────────────────────────
    const receivedHash = params.get("hash");
    if (!receivedHash) {
      throw new UnauthorizedException(
        "Invalid Telegram initData: missing hash field."
      );
    }
    params.delete("hash");

    // ── 3. Build data-check string (sorted params, one per line) ─────────────
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    // ── 4. Derive secret key: HMAC-SHA256("WebAppData", bot_token) ───────────
    const secretKey = createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    // ── 5. Compute expected hash ─────────────────────────────────────────────
    const expectedHash = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    // ── 6. Constant-time comparison (prevents timing attacks) ────────────────
    if (receivedHash.length !== expectedHash.length) {
      throw new UnauthorizedException(
        "Invalid Telegram initData: signature mismatch."
      );
    }
    try {
      const isValid = timingSafeEqual(
        Buffer.from(receivedHash, "hex"),
        Buffer.from(expectedHash, "hex")
      );
      if (!isValid) {
        throw new UnauthorizedException(
          "Invalid Telegram initData: signature mismatch."
        );
      }
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException(
        "Invalid Telegram initData: signature comparison failed."
      );
    }

    // ── 7. Validate auth_date (replay attack prevention) ─────────────────────
    const authDateStr = params.get("auth_date");
    const authDate = parseInt(authDateStr ?? "0", 10);
    if (!authDate || isNaN(authDate)) {
      throw new UnauthorizedException(
        "Invalid Telegram initData: missing auth_date."
      );
    }

    const nowSecs = Math.floor(Date.now() / 1000);
    if (nowSecs - authDate > maxAgeSecs) {
      throw new UnauthorizedException(
        "Invalid Telegram initData: authentication has expired. Please try again."
      );
    }

    // ── 8. Parse user object ─────────────────────────────────────────────────
    const userJson = params.get("user");
    if (!userJson) {
      throw new UnauthorizedException(
        "Invalid Telegram initData: missing user field."
      );
    }

    let telegramUser: any;
    try {
      telegramUser = JSON.parse(userJson);
    } catch {
      throw new UnauthorizedException(
        "Invalid Telegram initData: malformed user JSON."
      );
    }

    if (!telegramUser.id) {
      throw new UnauthorizedException(
        "Invalid Telegram initData: user.id is missing."
      );
    }

    return {
      id: BigInt(telegramUser.id),
      firstName: telegramUser.first_name ?? "User",
      lastName: telegramUser.last_name,
      username: telegramUser.username,
      photoUrl: telegramUser.photo_url,
      authDate,
    };
  }
}
