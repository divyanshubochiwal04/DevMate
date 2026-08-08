import { IsBoolean, IsOptional } from "class-validator";

/**
 * LogoutDto — input for POST /auth/logout.
 *
 * When allDevices is true, all active sessions for the user are revoked.
 * When omitted or false, only the current session (from the access token's `sid`) is revoked.
 */
export class LogoutDto {
  @IsOptional()
  @IsBoolean()
  allDevices?: boolean;
}
