import { createHash, timingSafeEqual } from "crypto";

/**
 * TokenHashUtil — cryptographic utilities for secure token storage and comparison.
 *
 * NEVER store raw refresh tokens in the database.
 * Always store SHA-256(token) and compare hashes using timingSafeEqual.
 */

/**
 * Computes the SHA-256 hash of a token string.
 * Returns a 64-character lowercase hex string.
 *
 * @param token - The raw refresh token string
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Performs a constant-time comparison of two token hash strings.
 * Prevents timing attacks that could reveal whether a hash is partially correct.
 *
 * Returns false immediately if lengths differ (cannot compare safely).
 *
 * @param hashA - First SHA-256 hex hash (64 chars)
 * @param hashB - Second SHA-256 hex hash (64 chars)
 */
export function safeCompareTokenHash(hashA: string, hashB: string): boolean {
  try {
    if (hashA.length !== hashB.length) return false;
    return timingSafeEqual(Buffer.from(hashA, "hex"), Buffer.from(hashB, "hex"));
  } catch {
    return false;
  }
}
