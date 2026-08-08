import { Request } from "express";
import { AuthenticatedUser } from "./authenticated-user.interface";

/**
 * RequestWithUser — extends Express Request to carry the authenticated user.
 * Used in controllers and guards that need type-safe access to request.user.
 */
export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}
