import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Request, Response } from "express";
import { CustomLogger, scrubResponse } from "../logger/custom-logger.service";

@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: CustomLogger) {
    this.logger.setContext("PrismaExceptionFilter");
  }

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.BAD_REQUEST;
    let message = "Database error";
    let errorType = "Database Error";

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case "P2002": {
          status = HttpStatus.CONFLICT;
          const targets = (exception.meta?.target as string[]) || [];
          message = `Unique constraint failed on field(s): ${targets.join(", ") || "unknown"}`;
          errorType = "Conflict";
          break;
        }
        case "P2025": {
          status = HttpStatus.NOT_FOUND;
          message = (exception.meta?.cause as string) || "Record not found";
          errorType = "Not Found";
          break;
        }
        case "P2003": {
          status = HttpStatus.BAD_REQUEST;
          const field = (exception.meta?.field_name as string) || "foreign key";
          message = `Foreign key constraint failed on field: ${field}`;
          errorType = "Bad Request";
          break;
        }
        default:
          status = HttpStatus.BAD_REQUEST;
          message = `Database query failed with code: ${exception.code}`;
          errorType = "Bad Request";
      }
      this.logger.warn(`Prisma error ${exception.code}: ${exception.message} at ${request.url}`);
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = "Database validation failed";
      errorType = "Bad Request";
      this.logger.warn(`Prisma validation error at ${request.url}`);
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = "Database operation failed";
      errorType = "Internal Server Error";
      this.logger.error("Unhandled database exception", exception.stack);
    }

    const errorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: (request as any).requestId || "unknown",
      correlationId: (request as any).correlationId || "unknown",
      message: [message],
      error: errorType,
    };

    response.status(status).json(scrubResponse(errorResponse));
  }
}
