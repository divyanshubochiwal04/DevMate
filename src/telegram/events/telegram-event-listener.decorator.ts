import { SetMetadata } from '@nestjs/common';

export const TELEGRAM_EVENT_LISTENER_METADATA = 'telegram:event_listener';

/**
 * Decorator to register a class method as a Telegram Event Listener.
 * Applied to methods of NestJS provider classes.
 */
export function TelegramEventListener(eventName: string): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    SetMetadata(TELEGRAM_EVENT_LISTENER_METADATA, eventName)(target, propertyKey, descriptor);
  };
}
