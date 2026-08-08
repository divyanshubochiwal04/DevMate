import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { FinanceService } from '../services/finance.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CreateAccountDto } from '../dto/account.dto';
import { CreateTransactionDto } from '../dto/transaction.dto';
import { CreateBudgetDto } from '../dto/budget.dto';
import { CreateLoanDto } from '../dto/loan.dto';
import { CreateSubscriptionDto } from '../dto/subscription.dto';
import { CreateRecurringTransactionDto } from '../dto/recurring.dto';
import { CreateCategoryDto } from '../dto/category.dto';
import { TransactionType, TransactionStatus } from '@prisma/client';

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // ─── Accounts ───
  @Post('accounts')
  async createAccount(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAccountDto) {
    const data = await this.financeService.createAccount(user.id, dto);
    return { success: true, data };
  }

  @Get('accounts')
  async listAccounts(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.financeService.listAccounts(user.id);
    return { success: true, data };
  }

  @Get('accounts/:id')
  async getAccount(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.financeService.getAccountById(id);
    return { success: true, data };
  }

  // ─── Transactions ───
  @Post('transactions')
  async createTransaction(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTransactionDto) {
    const data = await this.financeService.createTransaction(user.id, dto);
    return { success: true, data };
  }

  @Get('transactions')
  async listTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('accountId') accountId?: string,
    @Query('type') type?: TransactionType,
    @Query('status') status?: TransactionStatus
  ) {
    const data = await this.financeService.listTransactions(user.id, { accountId, type, status });
    return { success: true, data };
  }

  // ─── Categories ───
  @Post('categories')
  async createCategory(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCategoryDto) {
    const data = await this.financeService.createCategory(user.id, dto);
    return { success: true, data };
  }

  @Get('categories')
  async listCategories(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.financeService.listCategories(user.id);
    return { success: true, data };
  }

  // ─── Budgets ───
  @Post('budgets')
  async createBudget(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBudgetDto) {
    const data = await this.financeService.createBudget(user.id, dto);
    return { success: true, data };
  }

  @Get('budgets')
  async listBudgets(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.financeService.listBudgets(user.id);
    return { success: true, data };
  }

  // ─── Loans ───
  @Post('loans')
  async createLoan(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLoanDto) {
    const data = await this.financeService.createLoan(user.id, dto);
    return { success: true, data };
  }

  @Get('loans')
  async listLoans(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.financeService.listLoans(user.id);
    return { success: true, data };
  }

  @Post('loans/emis/:id/pay')
  async payEMI(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto?: { lateFee?: string }) {
    const data = await this.financeService.payEMI(id, dto?.lateFee);
    return { success: true, data };
  }

  // ─── Subscriptions ───
  @Post('subscriptions')
  async createSubscription(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSubscriptionDto) {
    const data = await this.financeService.createSubscription(user.id, dto);
    return { success: true, data };
  }

  @Get('subscriptions')
  async listSubscriptions(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.financeService.listSubscriptions(user.id);
    return { success: true, data };
  }

  // ─── Recurring Transactions ───
  @Post('recurring')
  async createRecurring(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRecurringTransactionDto) {
    const data = await this.financeService.createRecurring(user.id, dto);
    return { success: true, data };
  }

  @Get('recurring')
  async listRecurring(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.financeService.listRecurring(user.id);
    return { success: true, data };
  }
}
