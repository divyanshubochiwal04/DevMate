import { CustomLogger } from '../../common/logger/custom-logger.service';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  logger?: CustomLogger,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  let delay = options.initialDelayMs ?? 1000;
  const maxDelay = options.maxDelayMs ?? 10000;
  const factor = options.factor ?? 2;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error?.code === 429 || error?.response?.error_code === 429;
      let retryAfter = 0;

      if (isRateLimit) {
        // Parse retry_after from Telegram response if present
        retryAfter = error?.parameters?.retry_after ?? error?.response?.parameters?.retry_after ?? 0;
        if (logger) {
          logger.warn(`Telegram API 429: Rate limited. Retry after ${retryAfter}s. Attempt ${attempt}/${maxRetries}`);
        }
      } else {
        if (logger) {
          logger.warn(`Telegram API Error: ${error.message || error}. Attempt ${attempt}/${maxRetries}`);
        }
      }

      if (attempt === maxRetries) {
        throw error;
      }

      // Wait: either the telegram mandated retryAfter seconds or the exponential delay
      const waitTime = isRateLimit && retryAfter > 0 ? retryAfter * 1000 : delay;
      await new Promise(resolve => setTimeout(resolve, waitTime));

      if (!isRateLimit) {
        delay = Math.min(delay * factor, maxDelay);
      }
    }
  }
  throw new Error('Unreachable code in withRetry');
}
