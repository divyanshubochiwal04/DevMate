import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { IEventBus } from '../../telegram/interfaces/event-bus.interface';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction } from '@prisma/client';
import { loggerContextStorage } from '../../common/logger/logger-context';
import { randomUUID } from 'crypto';
import {
  VaultItemCreatedEvent,
  VaultItemUpdatedEvent,
  VaultItemDeletedEvent,
  VaultItemRestoredEvent,
  VaultFileUploadedEvent,
  VaultFileDeletedEvent,
} from './vault-events';

@Injectable()
export class VaultAuditListener implements OnModuleInit {
  constructor(
    @Inject(IEventBus) private readonly eventBus: IEventBus,
    private readonly prisma: PrismaService
  ) {}

  onModuleInit() {
    // 1. Vault Item Created
    this.eventBus.subscribe(VaultItemCreatedEvent.eventName, async (payload: any) => {
      await this.writeAudit(payload.userId, 'vault_items', payload.itemId, AuditAction.INSERT, null, {
        type: payload.metadata.type,
        title: payload.metadata.title,
      });
    });

    // 2. Vault Item Updated
    this.eventBus.subscribe(VaultItemUpdatedEvent.eventName, async (payload: any) => {
      await this.writeAudit(payload.userId, 'vault_items', payload.itemId, AuditAction.UPDATE, null, {
        title: payload.metadata.title,
      });
    });

    // 3. Vault Item Deleted
    this.eventBus.subscribe(VaultItemDeletedEvent.eventName, async (payload: any) => {
      await this.writeAudit(payload.userId, 'vault_items', payload.itemId, AuditAction.DELETE, null, {
        deletedAt: new Date(),
      });
    });

    // 4. Vault Item Restored
    this.eventBus.subscribe(VaultItemRestoredEvent.eventName, async (payload: any) => {
      await this.writeAudit(payload.userId, 'vault_items', payload.itemId, AuditAction.UPDATE, null, {
        restoredAt: new Date(),
      });
    });

    // 5. Vault File Uploaded
    this.eventBus.subscribe(VaultFileUploadedEvent.eventName, async (payload: any) => {
      await this.writeAudit(payload.userId, 'vault_files', payload.fileId, AuditAction.INSERT, null, {
        name: payload.metadata.name,
      });
    });

    // 6. Vault File Deleted
    this.eventBus.subscribe(VaultFileDeletedEvent.eventName, async (payload: any) => {
      await this.writeAudit(payload.userId, 'vault_files', payload.fileId, AuditAction.DELETE, null, {
        deletedAt: new Date(),
      });
    });
  }

  private async writeAudit(
    userId: string,
    tableName: string,
    recordId: string,
    action: AuditAction,
    oldValue: any,
    newValue: any
  ) {
    const store = loggerContextStorage.getStore();
    const requestId = store?.requestId || null;
    const correlationId = store?.correlationId || randomUUID();

    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          tableName,
          recordId,
          action,
          oldValue: oldValue || undefined,
          newValue: newValue || undefined,
          requestId,
          correlationId,
          version: 1,
        },
      });
    } catch (err) {
      console.error(`[VaultAuditListener] Failed to write decoupled audit log:`, err);
    }
  }
}
