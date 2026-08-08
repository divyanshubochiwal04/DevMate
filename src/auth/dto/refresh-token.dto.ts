import { IsString, IsNotEmpty } from "class-validator";

/**
 * RefreshTokenDto — input for POST /auth/refresh.
 *
 * The client provides the refresh token obtained at login.
 * A new token pair is returned; the old refresh token is invalidated.
 *
 * SECURITY: Store refresh tokens in httpOnly cookies, not localStorage.
 */
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty({ message: "refreshToken is required" })
  refreshToken!: string;
}
