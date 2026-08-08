import { IsString, IsOptional, IsEnum, IsUUID, IsArray, IsInt, Min, Length, IsDateString, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { PriorityLevel, TodoStatus } from '@prisma/client';
import { ChecklistDto } from './create-todo.dto';

export class UpdateTodoDto {
  @IsInt()
  @Min(1)
  version!: number; // Required for optimistic concurrency check

  @IsOptional()
  @IsString()
  @Length(1, 255)
  title?: string;

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
  @IsInt()
  @Min(0)
  actualDuration?: number; // In minutes

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
  attachmentFileIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistDto)
  checklists?: ChecklistDto[];
}
