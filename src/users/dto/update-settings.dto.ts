import { IsOptional, IsBoolean, IsString, IsNumber, ValidateNested, Matches, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PrivacySettingsDto {
  @IsOptional()
  @IsBoolean()
  showProfilePhoto?: boolean;

  @IsOptional()
  @IsBoolean()
  shareSplitHistory?: boolean;
}

export class SecuritySettingsDto {
  @IsOptional()
  @IsBoolean()
  twoFactorEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  loginAlertsEnabled?: boolean;
}

export class TelegramPreferencesDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  inlineResultsLimit?: number;

  @IsOptional()
  @IsBoolean()
  autoDownloadMedia?: boolean;
}

export class AIPreferencesDto {
  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;
}

export class UpdateSettingsDto {
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'quietHoursStart must be in HH:MM format',
  })
  quietHoursStart?: string;

  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'quietHoursEnd must be in HH:MM format',
  })
  quietHoursEnd?: string;

  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'summaryTime must be in HH:MM format',
  })
  summaryTime?: string;

  @IsOptional()
  @IsBoolean()
  notifyEnabled?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => PrivacySettingsDto)
  privacySettings?: PrivacySettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SecuritySettingsDto)
  securitySettings?: SecuritySettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TelegramPreferencesDto)
  telegramPreferences?: TelegramPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AIPreferencesDto)
  aiPreferences?: AIPreferencesDto;
}
