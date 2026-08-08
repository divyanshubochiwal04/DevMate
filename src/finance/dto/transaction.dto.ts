import { IsString, IsOptional, IsEnum, IsUUID, IsNumberString, IsDateString, Length } from 'class-validator';
import { TransactionType, TransactionStatus, Currency } from '@prisma/client';

export class CreateTransactionDto {
  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsNumberString()
  amount!: string;

  @IsEnum(Currency)
  currency!: Currency;

  @IsString()
  @Length(1, 255)
  description!: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsUUID()
  accountId!: string;

  @IsOptional()
  @IsUUID()
  toAccountId?: string;

  @IsOptional()
  @IsNumberString()
  exchangeRate?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
