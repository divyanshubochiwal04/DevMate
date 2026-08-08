import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";
import { CustomLogger, scrubResponse } from "../logger/custom-logger.service";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: CustomLogger) {
    this.logger.setContext("ExceptionFilter");
  }

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const isProduction = process.env.NODE_ENV === "production";

    // 1. Resolve exception message details
    let message: any = "Internal server error";
    let errorDetails: string | null = null;

    if (exception instanceof HttpException) {
      const responseContent = exception.getResponse();
      if (typeof responseContent === "object" && responseContent !== null) {
        message = (responseContent as any).message || exception.message;
        errorDetails = (responseContent as any).error || null;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Standardize validation array errors or string errors to string[]
    const errorMessages = Array.isArray(message) ? message : [String(message)];

    // 2. Format the response object matching enterprise standards
    const errorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: (request as any).requestId || "unknown",
      correlationId: (request as any).correlationId || "unknown",
      message: errorMessages,
      error:
        errorDetails ||
        (HttpStatus[status]
          ? HttpStatus[status].replace(/_/g, " ")
          : "Internal Server Error"),
      // Hide stack trace in production to prevent data/code leaks
      ...(isProduction ? {} : { stack: exception.stack }),
    };

    // 3. Logger execution
    if (status >= 500) {
      this.logger.error(
        `[500] ${request.method} ${request.url} - Error: ${exception.message}`,
        exception.stack
      );
    } else {
      this.logger.warn(
        `[${status}] ${request.method} ${request.url} - Warning: ${exception.message}`
      );
    }

    response.status(status).json(scrubResponse(errorResponse));
  }
}
