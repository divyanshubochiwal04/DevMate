import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { loggerContextStorage } from "../logger/logger-context";

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // 1. Identify correlation ID from headers or generate a new one
    const incomingCorrelationId =
      req.header("x-correlation-id") ||
      req.header("x-request-id") ||
      req.header("correlation-id") ||
      req.header("request-id");

    const correlationId = incomingCorrelationId || randomUUID();
    
    // 2. Generate a unique ID specifically for this internal request cycle
    const requestId = randomUUID();

    // 3. Attach variables directly to the request object
    (req as any).correlationId = correlationId;
    (req as any).requestId = requestId;

    // 4. Return variables in the response headers for client/API callers
    res.setHeader("x-correlation-id", correlationId);
    res.setHeader("x-request-id", requestId);

    // 5. Wrap execution context inside AsyncLocalStorage store to propagate values
    loggerContextStorage.run({ requestId, correlationId }, () => {
      next();
    });
  }
}
