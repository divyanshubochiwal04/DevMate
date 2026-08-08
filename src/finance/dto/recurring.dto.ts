import { IsEnum, IsOptional, IsUUID, IsInt, IsString, IsNumberString, IsDateString, Length, Min } from 'class-validator';
import { TransactionType, Currency, ReminderFrequency } from '@prisma/client';

export class CreateRecurringTransactionDto {
  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsNumberString()
  amount!: string;

  @IsEnum(Currency)
  currency!: Currency;

  @IsString()
  @Length(1, 255)
  description!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsUUID()
  accountId!: string;

  @IsOptional()
  @IsUUID()
  toAccountId?: string;

  @IsEnum(ReminderFrequency)
  frequency!: ReminderFrequency;

  @IsOptional()
  @IsString()
  rrule?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxOccurrences?: number;
}
