import { Injectable, Inject, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { UsersRepository } from '../repositories/users.repository';
import { IUserCache } from '../interfaces/user-cache.interface';
import { IEventBus } from '../../telegram/interfaces/event-bus.interface';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';
import { UpdateSettingsDto } from '../dto/update-settings.dto';
import { UserProfileEntity } from '../entities/user-profile.entity';
import { UserPreferencesEntity } from '../entities/user-preferences.entity';
import { UserSettingsEntity } from '../entities/user-settings.entity';
import { UserProfileUpdatedEvent, UserPreferencesUpdatedEvent, UserSettingsUpdatedEvent } from '../events/user-events';
import { CustomLogger } from '../../common/logger/custom-logger.service';

const RESERVED_USERNAMES = [
  'admin',
  'superadmin',
  'system',
  'devmate',
  'auth',
  'users',
  'preferences',
  'settings',
  'api',
  'null',
  'undefined',
  'bot',
  'telegram',
  'root',
  'administrator',
];

@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    @Inject(IUserCache) private readonly cache: IUserCache,
    @Inject(IEventBus) private readonly eventBus: IEventBus,
    private readonly logger: CustomLogger
  ) {
    this.logger.setContext('UsersService');
  }

  private getCacheKey(userId: string, type: 'profile' | 'preferences' | 'settings'): string {
    return `user:${userId}:${type}`;
  }

  async getUserProfile(userId: string): Promise<UserProfileEntity> {
    const cacheKey = this.getCacheKey(userId, 'profile');
    const cached = await this.cache.get<UserProfileEntity>(cacheKey);
    if (cached) {
      return new UserProfileEntity(cached);
    }

    const user = await this.repository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const entity = new UserProfileEntity({
      id: user.id,
      telegramId: user.telegramId.toString(),
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      bio: user.bio,
      country: user.country,
      avatarFileId: user.avatarFileId,
      timezone: user.preferences?.timezone || 'UTC',
      language: user.preferences?.language || 'EN',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastActive: user.lastActive,
    });

    await this.cache.set(cacheKey, entity, 300); // 5 min TTL
    return entity;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfileEntity> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const updateData: any = {};

    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.bio !== undefined) updateData.bio = dto.bio;
    if (dto.country !== undefined) updateData.country = dto.country;
    if (dto.avatarFileId !== undefined) updateData.avatarFileId = dto.avatarFileId;

    if (dto.username !== undefined) {
      const normalizedUsername = dto.username.toLowerCase();

      // Check reserved list
      if (RESERVED_USERNAMES.includes(normalizedUsername)) {
        throw new BadRequestException(`Username "${dto.username}" is reserved and cannot be used`);
      }

      // If username is changing, check uniqueness and 30-day limitation
      if (normalizedUsername !== user.username) {
        const existing = await this.repository.findByUsername(normalizedUsername);
        if (existing) {
          throw new ConflictException(`Username "${dto.username}" is already taken`);
        }

        // Enforce 30-day username change limitation
        if (user.lastUsernameChange) {
          const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
          const timeSinceChange = Date.now() - user.lastUsernameChange.getTime();
          if (timeSinceChange < thirtyDaysInMs) {
            const daysLeft = Math.ceil((thirtyDaysInMs - timeSinceChange) / (24 * 60 * 60 * 1000));
            throw new BadRequestException(`Username can only be changed once every 30 days. Please wait ${daysLeft} more day(s).`);
          }
        }

        updateData.username = normalizedUsername;
        updateData.lastUsernameChange = new Date();
      }
    }

    const updatedUser = await this.repository.updateProfile(userId, updateData);

    // Invalidate profile cache
    await this.cache.delete(this.getCacheKey(userId, 'profile'));

    // Fetch fresh profile with relations to build presentation entity
    const freshProfile = await this.getUserProfile(userId);

    // Emit event
    const eventPayload = new UserProfileUpdatedEvent(
      freshProfile.id,
      freshProfile.telegramId,
      freshProfile.username,
      freshProfile.firstName,
      freshProfile.lastName,
      freshProfile.bio,
      freshProfile.country,
      freshProfile.avatarFileId,
      updatedUser.updatedAt
    );
    await this.eventBus.publish(UserProfileUpdatedEvent.eventName, eventPayload);

    return freshProfile;
  }

  async getUserPreferences(userId: string): Promise<UserPreferencesEntity> {
    const cacheKey = this.getCacheKey(userId, 'preferences');
    const cached = await this.cache.get<UserPreferencesEntity>(cacheKey);
    if (cached) {
      return new UserPreferencesEntity(cached);
    }

    const user = await this.repository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Return defaults if preferences not initialized
    const entity = new UserPreferencesEntity({
      baseCurrency: user.preferences?.baseCurrency || 'USD',
      timezone: user.preferences?.timezone || 'UTC',
      language: user.preferences?.language || 'EN',
      theme: user.preferences?.theme || 'DARK',
      dateFormat: user.preferences?.dateFormat || 'YYYY_MM_DD',
      timeFormat: user.preferences?.timeFormat || 'H24',
      numberFormat: user.preferences?.numberFormat || 'COMMAS',
      measurementUnits: user.preferences?.measurementUnits || 'METRIC',
      weekStartDay: user.preferences?.weekStartDay || 'MONDAY',
      notificationPreferences: user.preferences?.notificationPreferences || {
        email: true,
        push: true,
        telegram: true,
        dailySummary: true,
      },
    });

    await this.cache.set(cacheKey, entity, 300);
    return entity;
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto): Promise<UserPreferencesEntity> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const updateData: any = {};
    if (dto.baseCurrency !== undefined) updateData.baseCurrency = dto.baseCurrency;
    if (dto.timezone !== undefined) updateData.timezone = dto.timezone;
    if (dto.language !== undefined) updateData.language = dto.language;
    if (dto.theme !== undefined) updateData.theme = dto.theme;
    if (dto.dateFormat !== undefined) updateData.dateFormat = dto.dateFormat;
    if (dto.timeFormat !== undefined) updateData.timeFormat = dto.timeFormat;
    if (dto.numberFormat !== undefined) updateData.numberFormat = dto.numberFormat;
    if (dto.measurementUnits !== undefined) updateData.measurementUnits = dto.measurementUnits;
    if (dto.weekStartDay !== undefined) updateData.weekStartDay = dto.weekStartDay;
    if (dto.notificationPreferences !== undefined) updateData.notificationPreferences = dto.notificationPreferences;

    const updatedPref = await this.repository.updatePreferences(userId, updateData);

    // Invalidate cache
    await this.cache.delete(this.getCacheKey(userId, 'preferences'));
    await this.cache.delete(this.getCacheKey(userId, 'profile')); // Profile includes language/timezone

    const freshPref = await this.getUserPreferences(userId);

    // Emit event
    const eventPayload = new UserPreferencesUpdatedEvent(
      userId,
      {
        baseCurrency: freshPref.baseCurrency,
        timezone: freshPref.timezone,
        language: freshPref.language,
        theme: freshPref.theme,
        dateFormat: freshPref.dateFormat,
        timeFormat: freshPref.timeFormat,
        numberFormat: freshPref.numberFormat,
        measurementUnits: freshPref.measurementUnits,
        weekStartDay: freshPref.weekStartDay,
        notificationPreferences: freshPref.notificationPreferences,
      },
      updatedPref.updatedAt
    );
    await this.eventBus.publish(UserPreferencesUpdatedEvent.eventName, eventPayload);

    return freshPref;
  }

  async getUserSettings(userId: string): Promise<UserSettingsEntity> {
    const cacheKey = this.getCacheKey(userId, 'settings');
    const cached = await this.cache.get<UserSettingsEntity>(cacheKey);
    if (cached) {
      return new UserSettingsEntity(cached);
    }

    const user = await this.repository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const entity = new UserSettingsEntity({
      quietHoursStart: user.settings?.quietHoursStart || null,
      quietHoursEnd: user.settings?.quietHoursEnd || null,
      summaryTime: user.settings?.summaryTime || '08:00',
      notifyEnabled: user.settings?.notifyEnabled ?? true,
      privacySettings: user.settings?.privacySettings || {
        showProfilePhoto: true,
        shareSplitHistory: true,
      },
      securitySettings: user.settings?.securitySettings || {
        twoFactorEnabled: false,
        loginAlertsEnabled: true,
      },
      telegramPreferences: user.settings?.telegramPreferences || {
        inlineResultsLimit: 10,
        autoDownloadMedia: true,
      },
      aiPreferences: user.settings?.aiPreferences || {
        modelName: 'gpt-4',
        temperature: 0.7,
      },
    });

    await this.cache.set(cacheKey, entity, 300);
    return entity;
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto): Promise<UserSettingsEntity> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const updateData: any = {};
    if (dto.quietHoursStart !== undefined) updateData.quietHoursStart = dto.quietHoursStart;
    if (dto.quietHoursEnd !== undefined) updateData.quietHoursEnd = dto.quietHoursEnd;
    if (dto.summaryTime !== undefined) updateData.summaryTime = dto.summaryTime;
    if (dto.notifyEnabled !== undefined) updateData.notifyEnabled = dto.notifyEnabled;
    if (dto.privacySettings !== undefined) updateData.privacySettings = dto.privacySettings;
    if (dto.securitySettings !== undefined) updateData.securitySettings = dto.securitySettings;
    if (dto.telegramPreferences !== undefined) updateData.telegramPreferences = dto.telegramPreferences;
    if (dto.aiPreferences !== undefined) updateData.aiPreferences = dto.aiPreferences;

    const updatedSettings = await this.repository.updateSettings(userId, updateData);

    // Invalidate cache
    await this.cache.delete(this.getCacheKey(userId, 'settings'));

    const freshSettings = await this.getUserSettings(userId);

    // Emit event
    const eventPayload = new UserSettingsUpdatedEvent(
      userId,
      {
        quietHoursStart: freshSettings.quietHoursStart,
        quietHoursEnd: freshSettings.quietHoursEnd,
        summaryTime: freshSettings.summaryTime,
        notifyEnabled: freshSettings.notifyEnabled,
        privacySettings: freshSettings.privacySettings,
        securitySettings: freshSettings.securitySettings,
        telegramPreferences: freshSettings.telegramPreferences,
        aiPreferences: freshSettings.aiPreferences,
      },
      updatedSettings.updatedAt
    );
    await this.eventBus.publish(UserSettingsUpdatedEvent.eventName, eventPayload);

    return freshSettings;
  }

  async updateLastActive(userId: string): Promise<void> {
    await this.repository.updateLastActive(userId, new Date());
    await this.cache.delete(this.getCacheKey(userId, 'profile'));
  }
}
