import "reflect-metadata";
import { NestFactory, Reflector } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ConfigService } from "./config/config.service";
import { CustomLogger } from "./common/logger/custom-logger.service";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { PrismaClientExceptionFilter } from "./common/filters/prisma-exception.filter";
import helmet from "helmet";
import * as compression from "compression";

async function bootstrap() {
  // 1. Fail-fast: create a temporary app context to load/validate environment vars first
  const tempApp = await NestFactory.createApplicationContext(AppModule, {
    logger: false, // Suppress logger output during this verification phase
  });
  const configService = tempApp.get(ConfigService);
  const logger = tempApp.get(CustomLogger);
  logger.setContext("Bootstrap");
  await tempApp.close();

  logger.log("Validated configuration schema. Initializing NestJS application...");

  // 2. Create the web application instance
  const app = await NestFactory.create(AppModule, {
    logger: logger, // Route all core NestJS system logging to CustomLogger
  });

  // 3. Configure prefix and versioning: `/api/v1/...`
  app.setGlobalPrefix("api");
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  });

  // 4. Secure headers via Helmet
  app.use(helmet());

  // 5. Enable Gzip HTTP response compression
  app.use(compression());

  // 6. Configure dynamic CORS based on ConfigService values
  const corsOrigin = configService.corsOrigin;
  app.enableCors({
    origin: corsOrigin.includes(",")
      ? corsOrigin.split(",").map((o) => o.trim())
      : corsOrigin,
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  });

  // 7. Global Pipes (Strict class validation and auto type coercion)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip non-whitelisted request payload properties
      forbidNonWhitelisted: true, // Throw exception if non-whitelisted fields exist
      transform: true, // Auto-transform payloads into DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Coerce string numbers/booleans automatically
      },
    })
  );

  // 8. Global Interceptors
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(
    new LoggingInterceptor(logger),
    new TransformInterceptor(reflector)
  );

  // 9. Global Exception Filters
  // Registered in order where the catch-all HttpExceptionFilter runs last,
  // allowing the PrismaClientExceptionFilter to handle DB errors first.
  app.useGlobalFilters(
    new HttpExceptionFilter(logger),
    new PrismaClientExceptionFilter(logger)
  );

  // 10. Enable Graceful Shutdown (SIGINT, SIGTERM handling for DB releases & HTTP drain)
  app.enableShutdownHooks();

  const port = configService.port;
  await app.listen(port);

  logger.log(`==================================================`);
  logger.log(`🚀 DevMate Application Bootstrap Success!`);
  logger.log(`🌍 Endpoint: http://localhost:${port}/api/v1`);
  logger.log(`🌱 Mode:     ${configService.nodeEnv}`);
  logger.log(`==================================================`);
}

bootstrap().catch((err) => {
  process.stderr.write(`[CRITICAL BOOTSTRAP FAILURE] ${err.message}\n${err.stack}\n`);
  process.exit(1);
});
