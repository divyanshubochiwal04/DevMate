import { Injectable } from '@nestjs/common';
import { ICommandRegistry, RegisteredCommand, CommandMetadata } from '../interfaces/command-registry.interface';
import { TelegramCommandHandler } from '../interfaces/command-handler.interface';

@Injectable()
export class CommandRegistryService implements ICommandRegistry {
  private readonly commands = new Map<string, RegisteredCommand>();
  private readonly aliasMap = new Map<string, string>();

  register(command: string, handler: TelegramCommandHandler, metadata: CommandMetadata): void {
    const cleanCmd = this.cleanCommandName(command);

    if (this.commands.has(cleanCmd)) {
      throw new Error(`Duplicate Telegram command collision detected: /${cleanCmd} is already registered.`);
    }
    if (this.aliasMap.has(cleanCmd)) {
      const owner = this.aliasMap.get(cleanCmd);
      throw new Error(`Duplicate Telegram command collision detected: /${cleanCmd} is already registered as an alias for /${owner}.`);
    }

    if (metadata.aliases) {
      for (const alias of metadata.aliases) {
        const cleanAlias = this.cleanCommandName(alias);
        if (this.commands.has(cleanAlias)) {
          throw new Error(`Duplicate Telegram command alias collision detected: alias /${cleanAlias} is already registered as a main command.`);
        }
        if (this.aliasMap.has(cleanAlias)) {
          const owner = this.aliasMap.get(cleanAlias);
          throw new Error(`Duplicate Telegram command alias collision detected: alias /${cleanAlias} is already registered as an alias for /${owner}.`);
        }
      }
    }

    const registered: RegisteredCommand = { handler, metadata };
    this.commands.set(cleanCmd, registered);

    if (metadata.aliases) {
      for (const alias of metadata.aliases) {
        const cleanAlias = this.cleanCommandName(alias);
        this.aliasMap.set(cleanAlias, cleanCmd);
      }
    }
  }

  get(commandName: string): RegisteredCommand | null {
    const cleanCmd = this.cleanCommandName(commandName);
    
    const direct = this.commands.get(cleanCmd);
    if (direct) {
      return direct;
    }

    const mappedCmd = this.aliasMap.get(cleanCmd);
    if (mappedCmd) {
      return this.commands.get(mappedCmd) || null;
    }

    return null;
  }

  getAll(): Map<string, RegisteredCommand> {
    return this.commands;
  }

  private cleanCommandName(name: string): string {
    let clean = name.trim().toLowerCase();
    if (clean.startsWith('/')) {
      clean = clean.substring(1);
    }
    return clean;
  }
}
