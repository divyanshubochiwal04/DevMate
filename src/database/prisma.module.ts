import { Module, Global } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { CustomLogger } from "../common/logger/custom-logger.service";

@Global()
@Module({
  providers: [PrismaService, CustomLogger],
  exports: [PrismaService],
})
export class PrismaModule {}
