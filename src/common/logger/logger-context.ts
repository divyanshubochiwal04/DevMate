import { AsyncLocalStorage } from "async_hooks";

export interface LoggerContext {
  requestId: string;
  correlationId: string;
}

export const loggerContextStorage = new AsyncLocalStorage<LoggerContext>();
