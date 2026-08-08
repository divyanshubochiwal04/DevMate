import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { ConfigService } from "../config/config.service";
import { CustomLogger } from "../common/logger/custom-logger.service";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: Pool;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: CustomLogger
  ) {
    // 1. Initialize the native pg Pool with the validated connection string
    const pool = new Pool({
      connectionString: configService.databaseUrl,
    });

    // 2. Create the Prisma database adapter wrapper
    const adapter = new PrismaPg(pool);

    // 3. Pass the adapter to the PrismaClient constructor options
    super({
      adapter,
      log: [
        { emit: "event", level: "query" },
        { emit: "event", level: "info" },
        { emit: "event", level: "warn" },
        { emit: "event", level: "error" },
      ],
    } as any);

    this.pool = pool;
    this.logger.setContext("PrismaService");
  }

  async onModuleInit() {
    this.logger.log("Connecting to PostgreSQL database...");

    const anyThis = this as any;

    anyThis.$on("query", (e: any) => {
      if (this.configService.nodeEnv === "development") {
        this.logger.debug(
          `Query: ${e.query} - Params: ${e.params} - Duration: ${e.duration}ms`
        );
      }
    });

    anyThis.$on("info", (e: any) => {
      this.logger.log(e.message);
    });

    anyThis.$on("warn", (e: any) => {
      this.logger.warn(e.message);
    });

    anyThis.$on("error", (e: any) => {
      this.logger.error(e.message);
    });

    await this.$connect();
    this.logger.log("Successfully connected to PostgreSQL database!");
  }

  async onModuleDestroy() {
    this.logger.log("Disconnecting from PostgreSQL database...");
    await this.$disconnect();
    // Gracefully shut down the connection pool
    await this.pool.end();
    this.logger.log("Successfully disconnected from PostgreSQL database!");
  }
}
