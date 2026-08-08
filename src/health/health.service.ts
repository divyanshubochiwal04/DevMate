import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { CustomLogger } from "../common/logger/custom-logger.service";

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: CustomLogger
  ) {
    this.logger.setContext("HealthService");
  }

  async checkHealth() {
    let dbStatus = "UP";
    let dbError = null;

    try {
      // Execute a quick database query to ensure PostgreSQL is active and accessible
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error: any) {
      dbStatus = "DOWN";
      dbError = error.message || "Database connection failure";
      this.logger.error(`Database health check failed: ${dbError}`);
    }

    const uptime = process.uptime();

    return {
      status: dbStatus === "UP" ? "UP" : "DEGRADED",
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime)}s`,
      version: "1.0.0",
      details: {
        database: {
          status: dbStatus,
          ...(dbError ? { error: dbError } : {}),
        },
      },
    };
  }
}
