import { Controller, Get, Post, Patch, Delete, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { SplitterService } from '../services/splitter.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { Currency, SplitType } from '@prisma/client';
import { IsString, IsOptional, IsEnum, IsUUID, IsNumberString, IsArray, ValidateNested, IsInt, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

// ─── DTOs ───
export class CreateGroupDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(Currency)
  defaultCurrency?: Currency;

  @IsOptional()
  @IsString()
  icon?: string;
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(Currency)
  defaultCurrency?: Currency;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsInt()
  version!: number;
}

export class AddMemberDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsString()
  displayName!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class PayerDto {
  @IsUUID()
  memberId!: string;

  @IsNumberString()
  amountPaid!: string;
}

export class ParticipantDto {
  @IsUUID()
  memberId!: string;

  @IsOptional()
  @IsNumberString()
  owedAmount?: string;

  @IsOptional()
  @IsNumberString()
  percentage?: string;

  @IsOptional()
  @IsNumberString()
  shares?: string;
}

export class CreateExpenseDto {
  @IsString()
  description!: string;

  @IsEnum(Currency)
  currency!: Currency;

  @IsNumberString()
  totalAmount!: string;

  @IsOptional()
  @IsString()
  expenseDate?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsEnum(SplitType)
  splitType!: SplitType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayerDto)
  payers!: PayerDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipantDto)
  participants!: ParticipantDto[];
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumberString()
  totalAmount?: string;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsString()
  expenseDate?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(SplitType)
  splitType?: SplitType;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayerDto)
  payers?: PayerDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipantDto)
  participants?: ParticipantDto[];

  @IsInt()
  version!: number;
}

export class CreateSettlementDto {
  @IsUUID()
  payerMemberId!: string;

  @IsUUID()
  receiverMemberId!: string;

  @IsNumberString()
  amount!: string;

  @IsEnum(Currency)
  currency!: Currency;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsBoolean()
  syncToFinance?: boolean;
}

export class CompleteSettlementDto {
  @IsInt()
  version!: number;
}

export class CancelSettlementDto {
  @IsInt()
  version!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

@Controller('splitter')
export class SplitterController {
  constructor(private readonly splitterService: SplitterService) {}

  // ─── Groups ───
  @Post('groups')
  async createGroup(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGroupDto) {
    const data = await this.splitterService.createGroup(user.id, dto);
    return { success: true, data };
  }

  @Get('groups')
  async listGroups(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.splitterService.listGroups(user.id);
    return { success: true, data };
  }

  @Get('groups/:id')
  async getGroup(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.splitterService.getGroup(user.id, id);
    return { success: true, data };
  }

  @Patch('groups/:id')
  async updateGroup(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateGroupDto) {
    const { version, ...rest } = dto;
    const data = await this.splitterService.updateGroup(user.id, id, version, rest);
    return { success: true, data };
  }

  @Post('groups/:id/archive')
  async archiveGroup(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: { version: number }) {
    const data = await this.splitterService.archiveGroup(user.id, id, dto.version);
    return { success: true, data };
  }

  // ─── Members ───
  @Post('groups/:id/members')
  async addMember(@CurrentUser() user: AuthenticatedUser, @Param('id') groupId: string, @Body() dto: AddMemberDto) {
    const data = await this.splitterService.addMember(user.id, groupId, dto);
    return { success: true, data };
  }

  @Get('groups/:id/members')
  async listMembers(@CurrentUser() user: AuthenticatedUser, @Param('id') groupId: string) {
    const data = await this.splitterService.listMembers(user.id, groupId);
    return { success: true, data };
  }

  @Delete('groups/:id/members/:memberId')
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') groupId: string,
    @Param('memberId') memberId: string
  ) {
    const data = await this.splitterService.removeMember(user.id, groupId, memberId);
    return { success: true, data };
  }

  // ─── Expenses ───
  @Post('groups/:id/expenses')
  async createExpense(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') groupId: string,
    @Body() dto: CreateExpenseDto
  ) {
    const data = await this.splitterService.createExpense(user.id, groupId, dto);
    return { success: true, data };
  }

  @Get('groups/:id/expenses')
  async listExpenses(@CurrentUser() user: AuthenticatedUser, @Param('id') groupId: string) {
    const data = await this.splitterService.listExpenses(user.id, groupId);
    return { success: true, data };
  }

  @Get('groups/:id/expenses/:expenseId')
  async getExpense(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') groupId: string,
    @Param('expenseId') expenseId: string
  ) {
    const data = await this.splitterService.getExpense(user.id, groupId, expenseId);
    return { success: true, data };
  }

  @Patch('groups/:id/expenses/:expenseId')
  async updateExpense(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') groupId: string,
    @Param('expenseId') expenseId: string,
    @Body() dto: UpdateExpenseDto
  ) {
    const { version, ...rest } = dto;
    const data = await this.splitterService.updateExpense(user.id, groupId, expenseId, version, rest);
    return { success: true, data };
  }

  @Delete('groups/:id/expenses/:expenseId')
  async voidExpense(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') groupId: string,
    @Param('expenseId') expenseId: string
  ) {
    const data = await this.splitterService.voidExpense(user.id, groupId, expenseId);
    return { success: true, data };
  }

  // ─── Balances & Debts ───
  @Get('groups/:id/balances')
  async getBalances(@CurrentUser() user: AuthenticatedUser, @Param('id') groupId: string) {
    const data = await this.splitterService.getBalances(user.id, groupId);
    return { success: true, data };
  }

  @Get('groups/:id/debts')
  async getDebts(@CurrentUser() user: AuthenticatedUser, @Param('id') groupId: string) {
    const data = await this.splitterService.getSimplifiedDebts(user.id, groupId);
    return { success: true, data };
  }

  // ─── Settlements ───
  @Post('groups/:id/settlements')
  async createSettlement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') groupId: string,
    @Body() dto: CreateSettlementDto
  ) {
    const data = await this.splitterService.createSettlement(user.id, groupId, dto);
    return { success: true, data };
  }

  @Get('groups/:id/settlements')
  async listSettlements(@CurrentUser() user: AuthenticatedUser, @Param('id') groupId: string) {
    const data = await this.splitterService.listSettlements(user.id, groupId);
    return { success: true, data };
  }

  @Post('groups/:id/settlements/:settlementId/complete')
  async completeSettlement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') groupId: string,
    @Param('settlementId') settlementId: string,
    @Body() dto: CompleteSettlementDto
  ) {
    const data = await this.splitterService.completeSettlement(user.id, groupId, settlementId, dto.version);
    return { success: true, data };
  }

  @Post('groups/:id/settlements/:settlementId/cancel')
  async cancelSettlement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') groupId: string,
    @Param('settlementId') settlementId: string,
    @Body() dto: CancelSettlementDto
  ) {
    const data = await this.splitterService.cancelSettlement(user.id, groupId, settlementId, dto.version, dto.notes);
    return { success: true, data };
  }
}
