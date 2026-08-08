import { Controller, Get, HttpCode, HttpStatus } from "@nestjs/common";
import { HealthService } from "./health.service";
import { BypassTransform } from "../common/decorators/bypass-transform.decorator";
import { SkipAuth } from "../common/decorators/skip-auth.decorator";

@SkipAuth()
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @BypassTransform() // Prevents formatting this response inside StandardResponse envelope
  async getHealth() {
    return this.healthService.checkHealth();
  }
}
