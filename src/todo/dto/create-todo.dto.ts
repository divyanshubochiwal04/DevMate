import { IsString, IsOptional, IsEnum, IsUUID, IsArray, IsInt, Min, Length, IsDateString, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { PriorityLevel, TodoStatus } from '@prisma/client';

export class ChecklistItemDto {
  @IsString()
  @Length(1, 255)
  title!: string;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}

export class ChecklistDto {
  @IsString()
  @Length(1, 255)
  title!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  items!: ChecklistItemDto[];
}

export class CreateTodoDto {
  @IsString()
  @Length(1, 255)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(PriorityLevel)
  priority?: PriorityLevel;

  @IsOptional()
  @IsEnum(TodoStatus)
  status?: TodoStatus;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  listId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedDuration?: number; // In minutes

  @IsOptional()
  @IsString()
  recurrenceRule?: string; // RRULE format

  @IsOptional()
  @IsUUID()
  parentTodoId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  labelIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  dependencies?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  attachmentFileIds?: string[]; // References VaultFile IDs

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistDto)
  checklists?: ChecklistDto[];
}
