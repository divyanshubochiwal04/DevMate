import { IsOptional, IsString, IsUUID, Length, Matches, IsISO31661Alpha2 } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 150)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 150)
  lastName?: string;

  @IsOptional()
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'username must contain only lowercase letters, numbers, and underscores',
  })
  username?: string;

  @IsOptional()
  @IsUUID()
  avatarFileId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  bio?: string;

  @IsOptional()
  @IsISO31661Alpha2({
    message: 'country must be a valid 2-letter ISO-3166-1 country code (uppercase)',
  })
  country?: string;
}
