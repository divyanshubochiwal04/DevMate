import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { FinanceService } from '../../finance/services/finance.service';
import { SettlementCompletedEvent } from './splitter-events';
import { TransactionType, TransactionStatus, AccountType, Prisma } from '@prisma/client';
import { CustomLogger } from '../../common/logger/custom-logger.service';
import { IEventHandler } from '../../events/interfaces/event-handler.interface';
import { EventHandlerRegistry } from '../../events/services/event-handler-registry.service';

@Injectable()
export class FinanceIntegrationListener implements OnModuleInit, IEventHandler {
  constructor(
    private readonly financeService: FinanceService,
    private readonly registry: EventHandlerRegistry,
    private readonly logger: CustomLogger
  ) {
    this.logger.setContext('FinanceIntegrationListener');
  }

  onModuleInit() {
    this.logger.log('Registering FinanceIntegrationListener with EventHandlerRegistry...');
    this.registry.register(SettlementCompletedEvent.eventName, 'FinanceIntegrationConsumer', this);
  }

  async handle(payload: any, eventName: string, tx?: Prisma.TransactionClient): Promise<void> {
    // Note: The payload here has the structure of the SettlementCompletedEvent envelope,
    // which contains the settlement object under 'payload'.
    this.logger.log(`FinanceIntegrationConsumer handling event ${eventName} (Settlement ID: ${payload.aggregateId})`);
    await this.handleSettlementCompleted(payload);
  }

  private async handleSettlementCompleted(event: any) {
    const settlement = event.payload;
    if (!settlement.syncToFinance) {
      this.logger.debug(`Settlement ${settlement.id} completed without syncToFinance flag. Skipping finance sync.`);
      return;
    }

    const { id: settlementId, payerMember, receiverMember, amount, currency } = settlement;

    // 1. Sync Payer Outflow (if payer is a registered user)
    if (payerMember.userId) {
      await this.syncPersonalTransaction(
        payerMember.userId,
        settlementId,
        TransactionType.EXPENSE,
        `-${amount.toString()}`,
        currency,
        `Settlement: Paid ${receiverMember.displayName}`
      );
    }

    // 2. Sync Receiver Inflow (if receiver is a registered user)
    if (receiverMember.userId) {
      await this.syncPersonalTransaction(
        receiverMember.userId,
        settlementId,
        TransactionType.INCOME,
        amount.toString(),
        currency,
        `Settlement: Received from ${payerMember.displayName}`
      );
    }
  }

  private async syncPersonalTransaction(
    userId: string,
    settlementId: string,
    type: TransactionType,
    amountStr: string,
    currency: any,
    description: string
  ) {
    // Idempotency: check if transaction with this reference already exists for the user
    const existingTx = await this.financeService.listTransactions(userId, { reference: settlementId });
    if (existingTx && existingTx.length > 0) {
      this.logger.log(`Idempotency Check: Transaction for settlement ${settlementId} already exists for user ${userId}. Skipping duplicate creation.`);
      return;
    }

    // Resolve or provision default account
    const accounts = await this.financeService.listAccounts(userId);
    let account = accounts[0];
    if (!account) {
      this.logger.log(`No finance account found for user ${userId}. Provisioning default CASH account for settlement sync.`);
      account = await this.financeService.createAccount(userId, {
        name: 'Main Cash',
        type: AccountType.CASH,
        currency: currency,
        openingBalance: '0.0000',
        allowNegativeBalance: true,
      });
    }

    // Create transaction via public FinanceService boundary
    await this.financeService.createTransaction(userId, {
      type,
      status: TransactionStatus.POSTED,
      amount: amountStr,
      currency,
      description,
      reference: settlementId,
      accountId: account.id,
    });

    this.logger.log(`Successfully synced settlement ${settlementId} transaction (${type}) for user ${userId} to account ${account.name}`);
  }
}
