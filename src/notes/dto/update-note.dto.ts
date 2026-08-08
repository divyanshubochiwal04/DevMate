import { IsString, IsOptional, IsEnum, IsUUID, IsArray, IsInt, Length, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NoteType } from '@prisma/client';
import { NoteAttachmentDto } from './create-note.dto';

export class UpdateNoteDto {
  @IsOptional()
  @IsString()
  @Length(1, 150)
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(NoteType)
  type?: NoteType;

  @IsOptional()
  @IsUUID()
  folderId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagNames?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NoteAttachmentDto)
  attachments?: NoteAttachmentDto[];

  @IsInt()
  version!: number;

  @IsString()
  @Length(1, 255)
  summary!: string;
}
