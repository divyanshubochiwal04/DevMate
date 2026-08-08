import { TelegramContext } from './telegram-context.interface';

export interface TelegramCommandHandler {
  handle(ctx: TelegramContext): Promise<void>;
}
