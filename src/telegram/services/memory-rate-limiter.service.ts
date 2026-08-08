import { Injectable } from '@nestjs/common';
import { IRateLimiter } from '../interfaces/rate-limiter.interface';

@Injectable()
export class MemoryRateLimiter implements IRateLimiter {
  private readonly requests = new Map<string, number[]>();

  async isRateLimited(userId: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];

    // Filter out requests outside the window
    const activeRequests = userRequests.filter(timestamp => now - timestamp < windowMs);

    if (activeRequests.length >= limit) {
      return true;
    }

    activeRequests.push(now);
    this.requests.set(userId, activeRequests);
    return false;
  }
}
