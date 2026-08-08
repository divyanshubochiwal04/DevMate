import { IsEnum, IsOptional, IsDateString } from 'class-validator';

export enum SnoozeType {
  MIN_5 = 'MIN_5',
  MIN_10 = 'MIN_10',
  MIN_30 = 'MIN_30',
  HOUR_1 = 'HOUR_1',
  TOMORROW = 'TOMORROW',
  CUSTOM = 'CUSTOM',
}

export class SnoozeReminderDto {
  @IsEnum(SnoozeType)
  snoozeType!: SnoozeType;

  @IsOptional()
  @IsDateString()
  customDateTime?: string; // Required when snoozeType is CUSTOM
}
