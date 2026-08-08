import { defineConfig } from "prisma/config";
import * as dotenv from "dotenv";
import * as path from "path";

// Load configuration file based on NODE_ENV, defaulting to '.env' if not set
const nodeEnv = process.env.NODE_ENV || "development";
const envFile = nodeEnv === "production" ? ".env.production" : `.env.${nodeEnv}`;
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// If the specific file didn't load a database URL, fall back to standard '.env'
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || databaseUrl.trim() === "") {
  throw new Error(
    `[CRITICAL] DATABASE_URL is not defined. Failed loading config from '${envFile}' or fallback '.env'. Application startup aborted.`
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseUrl,
  },
});
