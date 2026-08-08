import { Module, Global } from '@nestjs/common';
import { EventHandlerRegistry } from './services/event-handler-registry.service';
import { OutboxService } from './services/outbox.service';
import { OutboxDispatcherService } from './services/outbox-dispatcher.service';
import { CustomLogger } from '../common/logger/custom-logger.service';

@Global()
@Module({
  providers: [
    EventHandlerRegistry,
    OutboxService,
    OutboxDispatcherService,
    CustomLogger,
  ],
  exports: [
    EventHandlerRegistry,
    OutboxService,
    OutboxDispatcherService,
  ],
})
export class EventsModule {}
