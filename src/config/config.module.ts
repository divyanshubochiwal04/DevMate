import { Module, Global } from "@nestjs/common";
import { ConfigService } from "./config.service";
import { validate } from "./env.validation";
import * as dotenv from "dotenv";
import * as path from "path";

@Global()
@Module({
  providers: [
    {
      provide: ConfigService,
      useFactory: () => {
        // Determine which environment file to load
        const nodeEnv = process.env.NODE_ENV || "development";
        const envFile = nodeEnv === "production" ? ".env.production" : `.env.${nodeEnv}`;

        // Load the selected environment variables file
        dotenv.config({ path: path.resolve(process.cwd(), envFile) });

        // For local development fallback convenience, also load standard '.env' if DATABASE_URL is missing
        if (!process.env.DATABASE_URL) {
          dotenv.config({ path: path.resolve(process.cwd(), ".env") });
        }

        // Validate raw process.env against the Zod schema
        const validatedEnv = validate(process.env);

        // Return a validated, strongly-typed ConfigService instance
        return new ConfigService(validatedEnv);
      },
    },
  ],
  exports: [ConfigService],
})
export class ConfigModule {}
