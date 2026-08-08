import { IsEnum, IsUUID, IsNumberString, IsDateString, IsOptional } from 'class-validator';
import { Currency, BudgetPeriod } from '@prisma/client';

export class CreateBudgetDto {
  @IsNumberString()
  amount!: string;

  @IsEnum(Currency)
  currency!: Currency;

  @IsEnum(BudgetPeriod)
  period!: BudgetPeriod;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
