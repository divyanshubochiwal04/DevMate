import { IsString, IsOptional, IsEnum, IsUUID, IsArray, IsInt, Length, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NoteType } from '@prisma/client';

export class NoteAttachmentDto {
  @IsUUID()
  vaultFileId!: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  caption?: string;
}

export class CreateNoteDto {
  @IsString()
  @Length(1, 150)
  title!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsEnum(NoteType)
  type?: NoteType;

  @IsOptional()
  @IsUUID()
  folderId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagNames?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NoteAttachmentDto)
  attachments?: NoteAttachmentDto[];
}
