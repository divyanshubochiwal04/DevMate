import { Module } from '@nestjs/common';
import { FinanceController } from './controllers/finance.controller';
import { FinanceService } from './services/finance.service';
import { FinanceRepository } from './repositories/finance.repository';
import {
  ExpenseCommandHandler,
  IncomeCommandHandler,
  BalanceCommandHandler,
  BudgetCommandHandler,
  LoanCommandHandler,
} from './telegram/finance-telegram-commands.service';
import { PrismaModule } from '../database/prisma.module';
import { CustomLogger } from '../common/logger/custom-logger.service';

@Module({
  imports: [PrismaModule],
  controllers: [FinanceController],
  providers: [
    CustomLogger,
    FinanceService,
    FinanceRepository,
    ExpenseCommandHandler,
    IncomeCommandHandler,
    BalanceCommandHandler,
    BudgetCommandHandler,
    LoanCommandHandler,
  ],
  exports: [FinanceService, FinanceRepository],
})
export class FinanceModule {}
