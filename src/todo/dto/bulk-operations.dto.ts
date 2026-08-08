import { IsArray, IsEnum, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TodoStatus } from '@prisma/client';
import { CreateTodoDto } from './create-todo.dto';

export class BulkCreateTodosDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTodoDto)
  todos!: CreateTodoDto[];
}

export class BulkUpdateStatusDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  ids!: string[];

  @IsEnum(TodoStatus)
  status!: TodoStatus;
}

export class BulkDeleteTodosDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  ids!: string[];
}
