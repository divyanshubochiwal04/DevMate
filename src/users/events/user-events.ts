export class UserProfileUpdatedEvent {
  static readonly eventName = 'UserProfileUpdated';
  constructor(
    public readonly userId: string,
    public readonly telegramId: string,
    public readonly username: string | null,
    public readonly firstName: string,
    public readonly lastName: string | null,
    public readonly bio: string | null,
    public readonly country: string | null,
    public readonly avatarFileId: string | null,
    public readonly updatedAt: Date,
  ) {}
}

export class UserPreferencesUpdatedEvent {
  static readonly eventName = 'UserPreferencesUpdated';
  constructor(
    public readonly userId: string,
    public readonly preferences: {
      baseCurrency: string;
      timezone: string;
      language: string;
      theme: string;
      dateFormat: string;
      timeFormat: string;
      numberFormat: string;
      measurementUnits: string;
      weekStartDay: string;
      notificationPreferences: any;
    },
    public readonly updatedAt: Date,
  ) {}
}

export class UserSettingsUpdatedEvent {
  static readonly eventName = 'UserSettingsUpdated';
  constructor(
    public readonly userId: string,
    public readonly settings: {
      quietHoursStart: string | null;
      quietHoursEnd: string | null;
      summaryTime: string;
      notifyEnabled: boolean;
      privacySettings: any;
      securitySettings: any;
      telegramPreferences: any;
      aiPreferences: any;
    },
    public readonly updatedAt: Date,
  ) {}
}
