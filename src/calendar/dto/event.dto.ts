import { IsString, IsOptional, IsEnum, IsBoolean, IsInt, Min, Max, Length, IsDateString, IsUUID, IsNumber, IsArray, ValidateNested, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';
import { EventType, EventStatus, RecurrenceFrequency, AttendeeStatus } from '@prisma/client';

export class CreateAttendeeDto {
  @IsString()
  @Length(1, 150)
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  telegramUsername?: string;

  @IsOptional()
  @IsEnum(AttendeeStatus)
  status?: AttendeeStatus;

  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class UpdateAttendeeDto {
  @IsOptional()
  @IsEnum(AttendeeStatus)
  status?: AttendeeStatus;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  telegramUsername?: string;
}

export class CreateEventReminderDto {
  @IsInt()
  @Min(0)
  offsetMinutes!: number;
}

export class CreateEventDto {
  @IsUUID()
  calendarId!: string;

  @IsString()
  @Length(1, 255)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  isAllDay?: boolean;

  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  locationName?: string;

  @IsOptional()
  @IsString()
  locationAddress?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsString()
  meetingUrl?: string;

  @IsOptional()
  @IsEnum(RecurrenceFrequency)
  recurrenceFrequency?: RecurrenceFrequency;

  @IsOptional()
  @IsString()
  rrule?: string;

  @IsOptional()
  @IsDateString()
  recurrenceEndAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  recurrenceCount?: number;

  @IsOptional()
  @IsUUID()
  todoId?: string;

  @IsOptional()
  @IsUUID()
  noteId?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  reminders?: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAttendeeDto)
  attendees?: CreateAttendeeDto[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  attachments?: string[];
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  isAllDay?: boolean;

  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  locationName?: string;

  @IsOptional()
  @IsString()
  locationAddress?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsString()
  meetingUrl?: string;

  @IsOptional()
  @IsEnum(RecurrenceFrequency)
  recurrenceFrequency?: RecurrenceFrequency;

  @IsOptional()
  @IsString()
  rrule?: string;

  @IsOptional()
  @IsDateString()
  recurrenceEndAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  recurrenceCount?: number;

  @IsOptional()
  @IsUUID()
  todoId?: string;

  @IsOptional()
  @IsUUID()
  noteId?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  reminders?: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAttendeeDto)
  attendees?: CreateAttendeeDto[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  attachments?: string[];

  @IsInt()
  @Min(1)
  version!: number;
}

export class RescheduleEventDto {
  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsInt()
  @Min(1)
  version!: number;
}

export class ModifyOccurrenceDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
