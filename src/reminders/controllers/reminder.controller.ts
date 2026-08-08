import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { ReminderService } from '../services/reminder.service';
import { CreateReminderDto } from '../dto/create-reminder.dto';
import { SnoozeReminderDto } from '../dto/snooze-reminder.dto';
import { ReminderEntity, ReminderHistoryEntity } from '../entities/reminder.entity';

@Controller('reminders')
export class ReminderController {
  constructor(private readonly reminderService: ReminderService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReminderDto
  ): Promise<{ success: boolean; data: ReminderEntity }> {
    const data = await this.reminderService.createReminder(user.id, dto);
    return { success: true, data };
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<{ success: boolean; data: ReminderEntity[] }> {
    const data = await this.reminderService.listReminders(user.id);
    return { success: true, data };
  }

  @Get('history')
  async getHistory(@CurrentUser() user: AuthenticatedUser): Promise<{ success: boolean; data: ReminderHistoryEntity[] }> {
    const data = await this.reminderService.getHistory();
    return { success: true, data };
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ): Promise<{ success: boolean; data: ReminderEntity }> {
    const data = await this.reminderService.getReminderById(id);
    return { success: true, data };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: { text?: string; triggerTime?: string; version: number }
  ): Promise<{ success: boolean; data: ReminderEntity }> {
    const data = await this.reminderService.updateReminder(user.id, id, dto);
    return { success: true, data };
  }

  @Post(':id/snooze')
  async snooze(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SnoozeReminderDto
  ): Promise<{ success: boolean; data: ReminderEntity }> {
    const data = await this.reminderService.snoozeReminder(user.id, id, dto);
    return { success: true, data };
  }

  @Post(':id/cancel')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ): Promise<{ success: boolean; data: ReminderEntity }> {
    const data = await this.reminderService.cancelReminder(user.id, id);
    return { success: true, data };
  }

  @Post(':id/resume')
  async resume(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ): Promise<{ success: boolean; data: ReminderEntity }> {
    const data = await this.reminderService.resumeReminder(user.id, id);
    return { success: true, data };
  }
}
