import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Subject, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { IEventBus } from '../interfaces/event-bus.interface';

interface EventEnvelope {
  name: string;
  payload: any;
}

@Injectable()
export class LocalEventBus implements IEventBus, OnModuleDestroy {
  private readonly event$ = new Subject<EventEnvelope>();
  private readonly subscriptions = new Map<string, Subscription[]>();

  async publish<T = any>(eventName: string, payload: T): Promise<void> {
    this.event$.next({ name: eventName, payload });
  }

  subscribe<T = any>(eventName: string, handler: (payload: T) => void | Promise<void>): void {
    const sub = this.event$
      .pipe(filter(event => event.name === eventName))
      .subscribe(async event => {
        try {
          await handler(event.payload);
        } catch (error) {
          // Log error gracefully
          console.error(`[LocalEventBus] Error handling event ${eventName}:`, error);
        }
      });

    if (!this.subscriptions.has(eventName)) {
      this.subscriptions.set(eventName, []);
    }
    this.subscriptions.get(eventName)!.push(sub);
  }

  onModuleDestroy() {
    for (const subs of this.subscriptions.values()) {
      subs.forEach(s => s.unsubscribe());
    }
    this.subscriptions.clear();
  }
}
