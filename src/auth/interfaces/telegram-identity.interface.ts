/**
 * TelegramIdentity — the verified Telegram user identity extracted
 * from a validated initData payload.
 *
 * All fields come directly from the `user` JSON object inside initData.
 * The BigInt telegramId is used as the unique key for user lookup/creation.
 */
export interface TelegramIdentity {
  /** Telegram user ID — used as the unique database key */
  id: bigint;

  /** User's first name */
  firstName: string;

  /** User's last name (optional) */
  lastName?: string;

  /** Telegram username without @ prefix (optional) */
  username?: string;

  /** URL to the user's profile photo (optional) */
  photoUrl?: string;

  /** Unix timestamp when the authentication was performed */
  authDate: number;
}
