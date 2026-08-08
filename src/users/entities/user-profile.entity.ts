export class UserProfileEntity {
  id!: string;
  telegramId!: string;
  username!: string | null;
  firstName!: string;
  lastName!: string | null;
  status!: string;
  bio!: string | null;
  country!: string | null;
  avatarFileId!: string | null;
  timezone!: string;
  language!: string;
  createdAt!: Date;
  updatedAt!: Date;
  lastActive!: Date | null;

  constructor(partial: Partial<UserProfileEntity>) {
    Object.assign(this, partial);
  }
}
