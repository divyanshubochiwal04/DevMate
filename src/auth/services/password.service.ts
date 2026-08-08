import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { ConfigService } from "../../config/config.service";

/**
 * PasswordService — bcrypt hash and comparison utility.
 *
 * Salt rounds are read from ConfigService (BCRYPT_ROUNDS env var).
 * Nothing is hardcoded.
 *
 * SECURITY:
 * - Never log plaintext passwords or hashes
 * - Never include hashes in API responses or JWT payloads
 */
@Injectable()
export class PasswordService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Hashes a plaintext password using bcrypt.
   * Salt rounds come from ConfigService.bcryptRounds.
   *
   * @param plaintext - The password to hash
   * @returns The bcrypt hash string
   */
  async hash(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, this.configService.bcryptRounds);
  }

  /**
   * Compares a plaintext candidate against a stored bcrypt hash.
   *
   * @param plaintext - The candidate password
   * @param hash - The stored bcrypt hash
   * @returns True if the password matches the hash
   */
  async compare(plaintext: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hash);
  }

  /**
   * Returns the configured number of bcrypt salt rounds.
   * Useful for audit logging or diagnostics.
   */
  get rounds(): number {
    return this.configService.bcryptRounds;
  }
}
