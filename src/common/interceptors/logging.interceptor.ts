import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { CustomLogger } from "../logger/custom-logger.service";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: CustomLogger) {
    this.logger.setContext("HTTP");
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();

    const { method, url, ip } = request;
    const userAgent = request.get("user-agent") || "unknown";
    const startTime = Date.now();

    // Log the request incoming state
    this.logger.log(`--> ${method} ${url} [IP: ${ip}] [Agent: ${userAgent}]`);

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;
          this.logger.log(`<-- ${method} ${url} ${statusCode} - ${duration}ms`);
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          const statusCode = err.status || 500;
          this.logger.error(
            `<-- ${method} ${url} ${statusCode} - ${duration}ms - Error: ${err.message}`
          );
        },
      }),
    );
  }
}
