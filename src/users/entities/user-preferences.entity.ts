import { Currency, Language, Theme, WeekDay, TimeFormat, DateFormat, MeasurementUnit } from '@prisma/client';

export class UserPreferencesEntity {
  baseCurrency!: Currency;
  timezone!: string;
  language!: Language;
  theme!: Theme;
  dateFormat!: DateFormat;
  timeFormat!: TimeFormat;
  numberFormat!: string;
  measurementUnits!: MeasurementUnit;
  weekStartDay!: WeekDay;
  notificationPreferences!: any;

  constructor(partial: Partial<UserPreferencesEntity>) {
    Object.assign(this, partial);
  }
}
