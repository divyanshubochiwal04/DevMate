import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";
import { RequestWithUser } from "../interfaces/request-with-user.interface";

/**
 * @CurrentUser() — extracts the authenticated user from the request.
 *
 * Optionally accepts a key to extract a specific field.
 *
 * @example
 * // Full user object
 * \@CurrentUser() user: AuthenticatedUser
 *
 * // Specific field
 * \@CurrentUser('id') userId: string
 * \@CurrentUser('roles') roles: string[]
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) return null;
    return field ? user[field] : user;
  }
);
