import { TelegramCommandHandler } from './command-handler.interface';

export interface CommandMetadata {
  command: string;
  aliases?: string[];
  permissions?: string[];
  category?: string;
  cooldown?: number; // in seconds
  adminOnly?: boolean;
  hidden?: boolean;
  description?: string;
}

export interface RegisteredCommand {
  handler: TelegramCommandHandler;
  metadata: CommandMetadata;
}

export interface ICommandRegistry {
  register(command: string, handler: TelegramCommandHandler, metadata: CommandMetadata): void;
  get(commandName: string): RegisteredCommand | null;
  getAll(): Map<string, RegisteredCommand>;
}

export const ICommandRegistry = Symbol('ICommandRegistry');
