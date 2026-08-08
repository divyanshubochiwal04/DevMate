import { IsEnum, IsOptional, IsString, IsTimeZone, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { Currency, Language, Theme, WeekDay, TimeFormat, DateFormat, MeasurementUnit } from '@prisma/client';

export class NotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @IsOptional()
  @IsBoolean()
  telegram?: boolean;

  @IsOptional()
  @IsBoolean()
  dailySummary?: boolean;
}

export class UpdatePreferencesDto {
  @IsOptional()
  @IsEnum(Currency)
  baseCurrency?: Currency;

  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @IsOptional()
  @IsEnum(Theme)
  theme?: Theme;

  @IsOptional()
  @IsEnum(DateFormat)
  dateFormat?: DateFormat;

  @IsOptional()
  @IsEnum(TimeFormat)
  timeFormat?: TimeFormat;

  @IsOptional()
  @IsString()
  numberFormat?: string;

  @IsOptional()
  @IsEnum(MeasurementUnit)
  measurementUnits?: MeasurementUnit;

  @IsOptional()
  @IsEnum(WeekDay)
  weekStartDay?: WeekDay;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  notificationPreferences?: NotificationPreferencesDto;
}
