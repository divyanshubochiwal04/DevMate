import { SetMetadata } from '@nestjs/common';
import { CommandMetadata } from '../../interfaces/command-registry.interface';

export const TELEGRAM_COMMAND_METADATA = 'telegram:command';

/**
 * Decorator to register a class as a Telegram Command Handler.
 * The class must implement TelegramCommandHandler.
 */
export function TelegramCommand(metadata: CommandMetadata): ClassDecorator {
  return (target: any) => {
    SetMetadata(TELEGRAM_COMMAND_METADATA, metadata)(target);
  };
}
