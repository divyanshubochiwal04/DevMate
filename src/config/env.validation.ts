import { z } from "zod";

export const environmentSchema = z.object({
  // Database Configuration
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .startsWith("postgres", "DATABASE_URL must be a PostgreSQL connection string"),

  // Server Configuration
  PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(4000),
  NODE_ENV: z.enum(["development", "production", "test"], {
    required_error: "NODE_ENV is required and must be development, production, or test",
  }),
  APP_URL: z.string().url("APP_URL must be a valid URL"),
  CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN is required"),

  // Security Configuration
  BCRYPT_ROUNDS: z.coerce
    .number()
    .int()
    .positive()
    .default(12),
  JWT_ACCESS_SECRET: z
    .string()
    .min(16, "JWT_ACCESS_SECRET must be at least 16 characters long"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, "JWT_REFRESH_SECRET must be at least 16 characters long"),
  JWT_ACCESS_EXPIRES: z.string().min(1, "JWT_ACCESS_EXPIRES is required").default("15m"),
  JWT_REFRESH_EXPIRES: z.string().min(1, "JWT_REFRESH_EXPIRES is required").default("7d"),
  JWT_ISSUER: z.string().min(1).default("devmate"),
  JWT_AUDIENCE: z.string().min(1).default("devmate-client"),

  // Vault Configuration
  VAULT_MASTER_KEY: z
    .string()
    .min(1, "VAULT_MASTER_KEY is required"),
  VAULT_STORAGE_PROVIDER: z
    .enum(["LOCAL", "S3", "GOOGLE_DRIVE", "TELEGRAM"])
    .default("LOCAL"),
  VAULT_LOCAL_STORAGE_PATH: z
    .string()
    .default("storage/vault"),
  VAULT_MAX_FILE_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .default(10485760), // 10MB default
  VAULT_ALLOWED_FILE_TYPES: z
    .string()
    .default("*"),

  // Third-party Integrations
  TELEGRAM_BOT_TOKEN: z
    .string()
    .min(1, "TELEGRAM_BOT_TOKEN is required"),
  OPENAI_API_KEY: z
    .string()
    .min(1, "OPENAI_API_KEY is required"),

  // Seed / Admin Configuration
  SUPER_ADMIN_TELEGRAM_ID: z
    .string()
    .min(1, "SUPER_ADMIN_TELEGRAM_ID is required for seeding the super admin account"),

  // Logging Configuration
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error", "fatal"])
    .default("info"),

  // Calendar Configuration
  CALENDAR_MAX_OCCURRENCES_PER_QUERY: z.coerce
    .number()
    .int()
    .positive()
    .default(365),

  // Outbox Configuration
  OUTBOX_POLL_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(1000),
  OUTBOX_BATCH_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .default(10),
  OUTBOX_MAX_ATTEMPTS: z.coerce
    .number()
    .int()
    .positive()
    .default(5),
  OUTBOX_LOCK_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(300000),
  OUTBOX_BASE_RETRY_DELAY_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(1000),
  OUTBOX_MAX_RETRY_DELAY_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60000),
});

export type EnvironmentVariables = z.infer<typeof environmentSchema>;

/**
 * Validates the environment variables against the schema.
 * Throws a descriptive error and exits the process immediately if validation fails.
 */
export function validate(config: Record<string, any>): EnvironmentVariables {
  const result = environmentSchema.safeParse(config);

  if (!result.success) {
    console.error("\n==================================================");
    console.error("❌ CRITICAL: Environment configuration validation failed!");
    console.error("The application cannot start. Please check your env files.\n");
    
    result.error.errors.forEach((err) => {
      console.error(`  - [${err.path.join(".")}] : ${err.message}`);
    });
    console.error("==================================================\n");

    // Exit immediately to satisfy the hard rule "startup must fail, never silently continue"
    process.exit(1);
  }

  // Cryptographic Master Key Verification
  const masterKey = result.data.VAULT_MASTER_KEY;
  try {
    // Check if valid Base64
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(masterKey)) {
      throw new Error("Invalid Base64 characters");
    }
    const buffer = Buffer.from(masterKey, "base64");
    if (buffer.length !== 32) {
      throw new Error(`Master key must decode to exactly 32 bytes, but got ${buffer.length} bytes`);
    }
  } catch (err: any) {
    console.error("\n==================================================");
    console.error("❌ CRITICAL: VAULT_MASTER_KEY cryptographic check failed!");
    console.error(`Error: ${err.message}`);
    console.error("Please supply a valid Base64 encoded 256-bit (32-byte) key.");
    console.error("==================================================\n");
    process.exit(1);
  }

  return result.data;
}
