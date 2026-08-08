export class UserSettingsEntity {
  quietHoursStart!: string | null;
  quietHoursEnd!: string | null;
  summaryTime!: string;
  notifyEnabled!: boolean;
  privacySettings!: any;
  securitySettings!: any;
  telegramPreferences!: any;
  aiPreferences!: any;

  constructor(partial: Partial<UserSettingsEntity>) {
    Object.assign(this, partial);
  }
}
