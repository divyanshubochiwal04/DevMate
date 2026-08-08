import { IsString, IsNotEmpty, IsOptional, MaxLength } from "class-validator";

/**
 * TelegramAuthDto — input for POST /auth/telegram.
 *
 * The client sends the raw `window.Telegram.WebApp.initData` string.
 * This is the standard Telegram Mini App authentication payload.
 */
export class TelegramAuthDto {
  /**
   * Raw initData string from window.Telegram.WebApp.initData.
   * Contains: query_id, user (JSON), auth_date, hash.
   */
  @IsString()
  @IsNotEmpty({ message: "initData is required" })
  initData!: string;

  /**
   * Client platform identifier.
   * Examples: 'ios', 'android', 'web', 'desktop'
   */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  platform?: string;

  /**
   * Human-readable device label chosen by the client.
   * Examples: 'iPhone 15 Pro', 'Chrome on Windows'
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceName?: string;
}
