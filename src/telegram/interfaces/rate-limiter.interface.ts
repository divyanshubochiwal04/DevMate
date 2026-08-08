export interface IRateLimiter {
  isRateLimited(userId: string, limit: number, windowMs: number): Promise<boolean>;
}

export const IRateLimiter = Symbol('IRateLimiter');
