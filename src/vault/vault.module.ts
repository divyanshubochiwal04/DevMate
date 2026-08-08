import { Module } from '@nestjs/common';
import { VaultService } from './services/vault.service';
import { VaultRepository } from './repositories/vault.repository';
import { VaultController } from './controllers/vault.controller';
import { IKeyManagementService } from './interfaces/key-management.interface';
import { LocalKeyManagementService } from './services/local-key-management.service';
import { IVaultStorageProvider } from './interfaces/vault-storage.interface';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { VaultAuditListener } from './events/vault-audit.listener';
import { VaultCommandHandler, SecretsCommandHandler } from './telegram/vault-telegram.service';
import { PrismaModule } from '../database/prisma.module';
import { ConfigModule } from '../config/config.module';
import { TelegramModule } from '../telegram/telegram.module';
import { CustomLogger } from '../common/logger/custom-logger.service';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    TelegramModule,
  ],
  controllers: [VaultController],
  providers: [
    VaultService,
    VaultRepository,
    VaultAuditListener,
    VaultCommandHandler,
    SecretsCommandHandler,
    CustomLogger,
    {
      provide: IKeyManagementService,
      useClass: LocalKeyManagementService,
    },
    {
      provide: IVaultStorageProvider,
      useClass: LocalStorageProvider,
    },
  ],
  exports: [VaultService],
})
export class VaultModule {}
