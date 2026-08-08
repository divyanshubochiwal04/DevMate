import { Injectable } from '@nestjs/common';
import { TelegramCommand } from '../../telegram/commands/decorators/telegram-command.decorator';
import { TelegramCommandHandler } from '../../telegram/interfaces/command-handler.interface';
import { TelegramContext } from '../../telegram/interfaces/telegram-context.interface';
import { VaultService } from '../services/vault.service';
import { MessageBuilder } from '../../telegram/builders/message.builder';

@Injectable()
@TelegramCommand({
  command: 'vault',
  aliases: ['vaultfiles'],
  category: 'security',
  cooldown: 2,
  description: 'List secure vault files and folders metadata: /vault',
})
export class VaultCommandHandler implements TelegramCommandHandler {
  constructor(private readonly vaultService: VaultService) {}

  async handle(ctx: TelegramContext) {
    if (!ctx.user) {
      await ctx.reply('❌ Authentication required to access the Vault.');
      return;
    }

    try {
      const folders = await this.vaultService.listFolders(ctx.user.id);
      const files = await this.vaultService.listFiles(ctx.user.id);

      const responseLines: string[] = ['🔐 *DevMate Secure Vault Metadata*'];

      if (folders.length > 0) {
        responseLines.push('\n📂 *Folders:*');
        folders.forEach(f => {
          responseLines.push(`• ${MessageBuilder.escapeMarkdownV2(f.name)}`);
        });
      }

      if (files.length > 0) {
        responseLines.push('\n📄 *Files:*');
        files.forEach(f => {
          const sizeKb = (Number(f.fileSize) / 1024).toFixed(1);
          responseLines.push(`• ${MessageBuilder.escapeMarkdownV2(f.name)} \\(${sizeKb} KB, status: ${f.status}\\)`);
        });
      }

      if (folders.length === 0 && files.length === 0) {
        responseLines.push('\nYour secure vault is currently empty.');
      }

      responseLines.push('\n⚠️ _Note: Plaintext file downloads are blocked over Telegram\\. Please use the secure DevMate Web client to download documents\\._');

      await ctx.reply(responseLines.join('\n'), { parse_mode: 'MarkdownV2' });
    } catch (err: any) {
      await ctx.reply(`❌ Failed to retrieve vault metadata: ${err.message}`);
    }
  }
}

@Injectable()
@TelegramCommand({
  command: 'secrets',
  category: 'security',
  cooldown: 2,
  description: 'List secure credentials and secrets metadata: /secrets',
})
export class SecretsCommandHandler implements TelegramCommandHandler {
  constructor(private readonly vaultService: VaultService) {}

  async handle(ctx: TelegramContext) {
    if (!ctx.user) {
      await ctx.reply('❌ Authentication required to access secure secrets.');
      return;
    }

    try {
      const items = await this.vaultService.listItems(ctx.user.id, {});

      const responseLines: string[] = ['🔐 *DevMate Encrypted Secrets*'];

      if (items.length > 0) {
        responseLines.push('');
        items.forEach(item => {
          const typeLabel = item.type.replace('_', ' ');
          responseLines.push(`• *${MessageBuilder.escapeMarkdownV2(item.title)}* \\(${MessageBuilder.escapeMarkdownV2(typeLabel)}\\)`);
        });
      } else {
        responseLines.push('\nNo credentials or secrets stored yet.');
      }

      responseLines.push('\n⚠️ _Note: For security reasons, decrypted passwords and credentials cannot be revealed over Telegram\\. Please log in to the secure DevMate Web client\\._');

      await ctx.reply(responseLines.join('\n'), { parse_mode: 'MarkdownV2' });
    } catch (err: any) {
      await ctx.reply(`❌ Failed to retrieve secrets metadata: ${err.message}`);
    }
  }
}
