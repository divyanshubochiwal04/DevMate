import { Injectable } from '@nestjs/common';
import { IEventHandler } from '../interfaces/event-handler.interface';

@Injectable()
export class EventHandlerRegistry {
  private readonly handlers = new Map<string, { consumerName: string; handler: IEventHandler }[]>();

  register(eventType: string, consumerName: string, handler: IEventHandler) {
    const list = this.handlers.get(eventType) || [];
    if (list.some(h => h.consumerName === consumerName)) {
      throw new Error(`Duplicate consumer registration: Consumer "${consumerName}" already registered for event "${eventType}"`);
    }
    list.push({ consumerName, handler });
    this.handlers.set(eventType, list);
  }

  getHandlers(eventType: string): { consumerName: string; handler: IEventHandler }[] {
    return this.handlers.get(eventType) || [];
  }
}
