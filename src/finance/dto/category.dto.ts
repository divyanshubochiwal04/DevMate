import { IsString, IsOptional, IsUUID, IsInt, IsBoolean, Length } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;
}
