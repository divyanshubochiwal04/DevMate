import { IsString, IsOptional, IsEnum, IsUUID, IsInt, Min, Max, Length, IsDateString } from 'class-validator';
import { ReminderType, ReminderFrequency, RetryStrategy } from '@prisma/client';

export class CreateReminderDto {
  @IsString()
  @Length(1, 500)
  text!: string;

  @IsEnum(ReminderType)
  type!: ReminderType;

  @IsOptional()
  @IsUUID()
  targetId?: string;

  @IsDateString()
  triggerTime!: string; // Future execution timestamp

  @IsOptional()
  @IsEnum(ReminderFrequency)
  frequency?: ReminderFrequency;

  @IsOptional()
  @IsString()
  rrule?: string; // Recurrence RFC 5545 rule

  @IsOptional()
  @IsString()
  timezone?: string; // e.g. "Asia/Kolkata", "UTC"

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  maxRetries?: number;

  @IsOptional()
  @IsEnum(RetryStrategy)
  retryStrategy?: RetryStrategy;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxOccurrences?: number;
}
