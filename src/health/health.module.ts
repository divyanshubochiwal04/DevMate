import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { CustomLogger } from "../common/logger/custom-logger.service";

@Module({
  controllers: [HealthController],
  providers: [HealthService, CustomLogger],
})
export class HealthModule {}
