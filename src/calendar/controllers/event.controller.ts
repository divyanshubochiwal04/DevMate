import { Controller, Get, Post, Patch, Delete, Param, Body, Query, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { CalendarService } from '../services/calendar.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CreateEventDto, UpdateEventDto, RescheduleEventDto, ModifyOccurrenceDto, CreateAttendeeDto, UpdateAttendeeDto } from '../dto/event.dto';
import { EventType, EventStatus } from '@prisma/client';

@Controller('calendar')
export class EventController {
  constructor(private readonly service: CalendarService) {}

  @Post('events')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEventDto
  ) {
    const data = await this.service.createEvent(user.id, dto);
    return { success: true, data };
  }

  @Get('events')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('calendarId') calendarId?: string,
    @Query('type') type?: EventType,
    @Query('status') status?: EventStatus,
    @Query('search') search?: string,
    @Query('hasReminder') hasReminder?: boolean,
    @Query('hasAttendees') hasAttendees?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    if (!from || !to) {
      throw new BadRequestException('Query parameters "from" and "to" are required.');
    }
    const data = await this.service.listEvents(user.id, {
      from,
      to,
      calendarId,
      type,
      status,
      search,
      hasReminder,
      hasAttendees,
      page,
      limit,
    });
    return { success: true, ...data };
  }

  @Get('events/:id')
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const data = await this.service.getEventById(user.id, id);
    return { success: true, data };
  }

  @Patch('events/:id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto
  ) {
    const data = await this.service.updateEvent(user.id, id, dto);
    return { success: true, data };
  }

  @Delete('events/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('version') versionStr: string
  ) {
    const version = parseInt(versionStr, 10);
    if (isNaN(version)) {
      throw new BadRequestException('Query parameter "version" is required.');
    }
    await this.service.deleteEvent(user.id, id, version);
  }

  @Post('events/:id/cancel')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('version') version: number
  ) {
    if (version === undefined) {
      throw new BadRequestException('Body parameter "version" is required.');
    }
    const data = await this.service.cancelEvent(user.id, id, version);
    return { success: true, data };
  }

  @Post('events/:id/complete')
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('version') version: number
  ) {
    if (version === undefined) {
      throw new BadRequestException('Body parameter "version" is required.');
    }
    const data = await this.service.completeEvent(user.id, id, version);
    return { success: true, data };
  }

  @Post('events/:id/reschedule')
  async reschedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RescheduleEventDto
  ) {
    const data = await this.service.rescheduleEvent(user.id, id, dto);
    return { success: true, data };
  }

  // ─── Calendar Views ───

  @Get('day')
  async getDayView(
    @CurrentUser() user: AuthenticatedUser,
    @Query('date') dateStr?: string,
    @Query('calendarId') calendarId?: string
  ) {
    const date = dateStr || new Date().toISOString().split('T')[0];
    const from = `${date}T00:00:00.000Z`;
    const to = `${date}T23:59:59.999Z`;

    const data = await this.service.listEvents(user.id, { from, to, calendarId });
    return { success: true, ...data };
  }

  @Get('week')
  async getWeekView(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDateStr?: string,
    @Query('calendarId') calendarId?: string
  ) {
    // Default start date to current week's Monday if not provided
    const start = startDateStr ? new Date(startDateStr) : new Date();
    if (isNaN(start.getTime())) {
      throw new BadRequestException('Invalid query parameter "startDate".');
    }
    if (!startDateStr) {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      start.setDate(diff);
    }
    start.setUTCHours(0, 0, 0, 0);

    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

    const data = await this.service.listEvents(user.id, {
      from: start.toISOString(),
      to: end.toISOString(),
      calendarId,
    });
    return { success: true, ...data };
  }

  @Get('month')
  async getMonthView(
    @CurrentUser() user: AuthenticatedUser,
    @Query('year') yearStr?: string,
    @Query('month') monthStr?: string, // 1-12
    @Query('calendarId') calendarId?: string
  ) {
    const now = new Date();
    const year = yearStr ? parseInt(yearStr, 10) : now.getUTCFullYear();
    const month = monthStr ? parseInt(monthStr, 10) - 1 : now.getUTCMonth();

    if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
      throw new BadRequestException('Invalid query parameters "year" or "month".');
    }

    const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

    const data = await this.service.listEvents(user.id, {
      from: start.toISOString(),
      to: end.toISOString(),
      calendarId,
    });
    return { success: true, ...data };
  }

  @Get('agenda')
  async getAgendaView(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('calendarId') calendarId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    if (!from || !to) {
      throw new BadRequestException('Query parameters "from" and "to" are required.');
    }
    const data = await this.service.listEvents(user.id, { from, to, calendarId, page, limit });
    return { success: true, ...data };
  }

  @Get('upcoming')
  async getUpcomingView(
    @CurrentUser() user: AuthenticatedUser,
    @Query('calendarId') calendarId?: string,
    @Query('limit') limit?: number
  ) {
    const from = new Date().toISOString();
    // Look ahead 30 days
    const to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const data = await this.service.listEvents(user.id, { from, to, calendarId, limit: limit || 10 });
    return { success: true, ...data };
  }

  @Get('events/:id/conflicts')
  async getConflicts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const data = await this.service.getConflicts(user.id, id);
    return { success: true, ...data };
  }

  // ─── Attendees ───

  @Post('events/:id/attendees')
  async addAttendee(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateAttendeeDto
  ) {
    const data = await this.service.addAttendee(user.id, id, dto);
    return { success: true, data };
  }

  @Patch('events/:id/attendees/:attendeeId')
  async updateAttendee(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('attendeeId') attendeeId: string,
    @Body() dto: UpdateAttendeeDto
  ) {
    const data = await this.service.updateAttendee(user.id, id, attendeeId, dto);
    return { success: true, data };
  }

  @Delete('events/:id/attendees/:attendeeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAttendee(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('attendeeId') attendeeId: string
  ) {
    await this.service.deleteAttendee(user.id, id, attendeeId);
  }

  // ─── Reminders ───

  @Post('events/:id/reminders')
  async addReminder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('offsetMinutes') offsetMinutes: number
  ) {
    if (offsetMinutes === undefined) {
      throw new BadRequestException('Body parameter "offsetMinutes" is required.');
    }
    const data = await this.service.addReminder(user.id, id, offsetMinutes);
    return { success: true, data };
  }

  @Delete('events/:id/reminders/:reminderId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteReminder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('reminderId') reminderId: string
  ) {
    await this.service.deleteReminder(user.id, id, reminderId);
  }

  // ─── Recurrence ───

  @Patch('events/:id/occurrences/:occurrenceDate')
  async modifyOccurrence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('occurrenceDate') occurrenceDateStr: string,
    @Body() dto: ModifyOccurrenceDto
  ) {
    const occurrenceDate = new Date(occurrenceDateStr);
    if (isNaN(occurrenceDate.getTime())) {
      throw new BadRequestException('Invalid "occurrenceDate" parameter.');
    }
    const data = await this.service.modifyOccurrence(user.id, id, occurrenceDate, dto);
    return { success: true, data };
  }

  @Delete('events/:id/occurrences/:occurrenceDate')
  async cancelOccurrence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('occurrenceDate') occurrenceDateStr: string
  ) {
    const occurrenceDate = new Date(occurrenceDateStr);
    if (isNaN(occurrenceDate.getTime())) {
      throw new BadRequestException('Invalid "occurrenceDate" parameter.');
    }
    const data = await this.service.cancelOccurrence(user.id, id, occurrenceDate);
    return { success: true, data };
  }

  // ─── Attachments ───

  @Post('events/:id/attachments')
  async addAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('vaultFileId') vaultFileId: string
  ) {
    if (!vaultFileId) {
      throw new BadRequestException('Body parameter "vaultFileId" is required.');
    }
    const data = await this.service.addAttachment(user.id, id, vaultFileId);
    return { success: true, data };
  }

  @Delete('events/:id/attachments/:attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('attachmentId') vaultFileId: string
  ) {
    await this.service.deleteAttachment(user.id, id, vaultFileId);
  }
}
