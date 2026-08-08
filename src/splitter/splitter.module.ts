import { Module } from '@nestjs/common';
import { SplitterController } from './controllers/splitter.controller';
import { SplitterService } from './services/splitter.service';
import { SplitBalanceService } from './services/split-balance.service';
import { DebtSimplificationService } from './services/debt-simplification.service';
import { SplitterRepository } from './repositories/splitter.repository';
import { FinanceIntegrationListener } from './events/finance-integration.listener';
import { FinanceModule } from '../finance/finance.module';
import { CustomLogger } from '../common/logger/custom-logger.service';
import {
  GroupsCommandHandler,
  GroupCommandHandler,
  SplitCommandHandler,
  BalanceCommandHandler,
  SettleCommandHandler,
} from './telegram/splitter-telegram.service';

@Module({
  imports: [FinanceModule],
  controllers: [SplitterController],
  providers: [
    CustomLogger,
    SplitterRepository,
    SplitterService,
    SplitBalanceService,
    DebtSimplificationService,
    FinanceIntegrationListener,

    // Telegram Command Handlers
    GroupsCommandHandler,
    GroupCommandHandler,
    SplitCommandHandler,
    BalanceCommandHandler,
    SettleCommandHandler,
  ],
  exports: [
    SplitterService,
    SplitBalanceService,
    DebtSimplificationService,
  ],
})
export class SplitterModule {}
