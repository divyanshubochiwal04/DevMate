import { IsString, IsOptional, IsEnum, IsBoolean, IsNumberString, IsDateString, Length } from 'class-validator';
import { Currency } from '@prisma/client';

export class CreateSubscriptionDto {
  @IsString()
  @Length(1, 150)
  name!: string;

  @IsNumberString()
  amount!: string;

  @IsEnum(Currency)
  currency!: Currency;

  @IsString()
  @Length(1, 30)
  cycle!: string; // "Monthly", "Yearly", etc.

  @IsDateString()
  nextBilling!: string;

  @IsOptional()
  @IsBoolean()
  trial?: boolean;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}
