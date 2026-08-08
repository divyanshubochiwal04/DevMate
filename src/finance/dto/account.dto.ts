import { IsString, IsOptional, IsEnum, IsBoolean, IsNumberString, Length, IsInt } from 'class-validator';
import { AccountType, Currency } from '@prisma/client';

export class CreateAccountDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsEnum(AccountType)
  type!: AccountType;

  @IsEnum(Currency)
  currency!: Currency;

  @IsOptional()
  @IsNumberString()
  openingBalance?: string;

  @IsOptional()
  @IsBoolean()
  allowNegativeBalance?: boolean;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType;

  @IsOptional()
  @IsBoolean()
  allowNegativeBalance?: boolean;

  @IsOptional()
  @IsInt()
  version?: number;
}
