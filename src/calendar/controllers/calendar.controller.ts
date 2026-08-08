import { Controller, Get, Post, Patch, Delete, Param, Body, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { CalendarService } from '../services/calendar.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CreateCalendarDto, UpdateCalendarDto } from '../dto/calendar.dto';

@Controller('calendars')
export class CalendarController {
  constructor(private readonly service: CalendarService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCalendarDto
  ) {
    const data = await this.service.createCalendar(user.id, dto);
    return { success: true, data };
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.service.listCalendars(user.id);
    return { success: true, data };
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    const data = await this.service.getCalendarById(user.id, id);
    return { success: true, data };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCalendarDto
  ) {
    const data = await this.service.updateCalendar(user.id, id, dto);
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('version') version: number
  ) {
    if (version === undefined) {
      throw new BadRequestException('Version is required.');
    }
    await this.service.deleteCalendar(user.id, id, version);
  }

  @Post(':id/default')
  async setDefault(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('version') version: number
  ) {
    if (version === undefined) {
      throw new BadRequestException('Version is required.');
    }
    const data = await this.service.setDefaultCalendar(user.id, id, version);
    return { success: true, data };
  }
}
