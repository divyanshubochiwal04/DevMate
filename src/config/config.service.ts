import { Injectable } from "@nestjs/common";
import { EnvironmentVariables } from "./env.validation";

@Injectable()
export class ConfigService {
  constructor(private readonly env: EnvironmentVariables) {}

  /**
   * Retrieves a strongly typed environment variable value by its key.
   */
  get<K extends keyof EnvironmentVariables>(key: K): EnvironmentVariables[K] {
    return this.env[key];
  }

  // Strongly-typed getters for compile-time safety and IDE autocomplete
  get databaseUrl(): string {
    return this.env.DATABASE_URL;
  }

  get port(): number {
    return this.env.PORT;
  }

  get nodeEnv(): "development" | "production" | "test" {
    return this.env.NODE_ENV;
  }

  get appUrl(): string {
    return this.env.APP_URL;
  }

  get corsOrigin(): string {
    return this.env.CORS_ORIGIN;
  }

  get bcryptRounds(): number {
    return this.env.BCRYPT_ROUNDS;
  }

  get jwtAccessSecret(): string {
    return this.env.JWT_ACCESS_SECRET;
  }

  get jwtRefreshSecret(): string {
    return this.env.JWT_REFRESH_SECRET;
  }

  get jwtAccessExpires(): string {
    return this.env.JWT_ACCESS_EXPIRES;
  }

  get jwtRefreshExpires(): string {
    return this.env.JWT_REFRESH_EXPIRES;
  }

  get jwtIssuer(): string {
    return this.env.JWT_ISSUER;
  }

  get jwtAudience(): string {
    return this.env.JWT_AUDIENCE;
  }

  get superAdminTelegramId(): string {
    return this.env.SUPER_ADMIN_TELEGRAM_ID;
  }

  get telegramBotToken(): string {
    return this.env.TELEGRAM_BOT_TOKEN;
  }

  get openaiApiKey(): string {
    return this.env.OPENAI_API_KEY;
  }

  get logLevel(): "debug" | "info" | "warn" | "error" | "fatal" {
    return this.env.LOG_LEVEL;
  }

  get vaultMasterKey(): string {
    return this.env.VAULT_MASTER_KEY;
  }

  get vaultStorageProvider(): "LOCAL" | "S3" | "GOOGLE_DRIVE" | "TELEGRAM" {
    return this.env.VAULT_STORAGE_PROVIDER;
  }

  get vaultLocalStoragePath(): string {
    return this.env.VAULT_LOCAL_STORAGE_PATH;
  }

  get vaultMaxFileSize(): number {
    return this.env.VAULT_MAX_FILE_SIZE;
  }

  get vaultAllowedFileTypes(): string {
    return this.env.VAULT_ALLOWED_FILE_TYPES;
  }

  get calendarMaxOccurrencesPerQuery(): number {
    return this.env.CALENDAR_MAX_OCCURRENCES_PER_QUERY;
  }

  get outboxPollIntervalMs(): number {
    if (process.env.NODE_ENV === 'test') {
      return 50; // Fast polling for integration tests
    }
    return this.env.OUTBOX_POLL_INTERVAL_MS;
  }

  get outboxBatchSize(): number {
    return this.env.OUTBOX_BATCH_SIZE;
  }

  get outboxMaxAttempts(): number {
    return this.env.OUTBOX_MAX_ATTEMPTS;
  }

  get outboxLockTimeoutMs(): number {
    return this.env.OUTBOX_LOCK_TIMEOUT_MS;
  }

  get outboxBaseRetryDelayMs(): number {
    return this.env.OUTBOX_BASE_RETRY_DELAY_MS;
  }

  get outboxMaxRetryDelayMs(): number {
    return this.env.OUTBOX_MAX_RETRY_DELAY_MS;
  }
}
