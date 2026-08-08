import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Request } from "express";

/**
 * BaseAuthGuard — shared token extraction utilities.
 *
 * Concrete guards extend this class to avoid repeating
 * the header-parsing logic. Does not implement CanActivate itself.
 */
@Injectable()
export abstract class BaseAuthGuard implements CanActivate {
  abstract canActivate(context: ExecutionContext): boolean | Promise<boolean>;

  /**
   * Extracts the Bearer token from the Authorization header.
   * Returns null if the header is missing or malformed.
   */
  protected extractBearerToken(request: Request): string | null {
    const authHeader = request.headers["authorization"];
    if (!authHeader || typeof authHeader !== "string") return null;

    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) return null;

    return token.trim();
  }

  /**
   * Extracts the HTTP request object from the ExecutionContext.
   */
  protected getRequest(context: ExecutionContext): Request {
    return context.switchToHttp().getRequest<Request>();
  }
}
