import { IsEnum, IsInt, IsNumberString, IsDateString, Min } from 'class-validator';
import { Currency, LoanDirection } from '@prisma/client';

export class CreateLoanDto {
  @IsNumberString()
  principal!: string;

  @IsEnum(Currency)
  currency!: Currency;

  @IsNumberString()
  interestRate!: string; // annual percentage rate (APR)

  @IsInt()
  @Min(1)
  durationMonths!: number;

  @IsDateString()
  startDate!: string;

  @IsEnum(LoanDirection)
  direction!: LoanDirection;
}
