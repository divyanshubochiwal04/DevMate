import { Controller, Get, Patch, Body } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { UsersService } from '../services/users.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';
import { UpdateSettingsDto } from '../dto/update-settings.dto';
import { UserProfileEntity } from '../entities/user-profile.entity';
import { UserPreferencesEntity } from '../entities/user-preferences.entity';
import { UserSettingsEntity } from '../entities/user-settings.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser): Promise<{ success: boolean; data: UserProfileEntity }> {
    const data = await this.usersService.getUserProfile(user.id);
    return { success: true, data };
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto
  ): Promise<{ success: boolean; data: UserProfileEntity }> {
    const data = await this.usersService.updateProfile(user.id, dto);
    return { success: true, data };
  }

  @Get('me/preferences')
  async getPreferences(@CurrentUser() user: AuthenticatedUser): Promise<{ success: boolean; data: UserPreferencesEntity }> {
    const data = await this.usersService.getUserPreferences(user.id);
    return { success: true, data };
  }

  @Patch('me/preferences')
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferencesDto
  ): Promise<{ success: boolean; data: UserPreferencesEntity }> {
    const data = await this.usersService.updatePreferences(user.id, dto);
    return { success: true, data };
  }

  @Get('me/settings')
  async getSettings(@CurrentUser() user: AuthenticatedUser): Promise<{ success: boolean; data: UserSettingsEntity }> {
    const data = await this.usersService.getUserSettings(user.id);
    return { success: true, data };
  }

  @Patch('me/settings')
  async updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto
  ): Promise<{ success: boolean; data: UserSettingsEntity }> {
    const data = await this.usersService.updateSettings(user.id, dto);
    return { success: true, data };
  }
}
