export interface IEventBus {
  publish<T = any>(eventName: string, payload: T): Promise<void>;
  subscribe<T = any>(eventName: string, handler: (payload: T) => void | Promise<void>): void;
}

export const IEventBus = Symbol('IEventBus');
