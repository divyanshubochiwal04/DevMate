import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { User, UserPreference, Setting } from '@prisma/client';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<(User & { preferences: UserPreference | null; settings: Setting | null }) | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        preferences: true,
        settings: true,
      },
    });
  }

  async findByTelegramId(telegramId: bigint): Promise<(User & { preferences: UserPreference | null; settings: Setting | null }) | null> {
    return this.prisma.user.findUnique({
      where: { telegramId },
      include: {
        preferences: true,
        settings: true,
      },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: 'insensitive',
        },
      },
    });
  }

  async updateProfile(id: string, data: Partial<User>): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async updatePreferences(userId: string, data: any): Promise<UserPreference> {
    return this.prisma.userPreference.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data,
      },
    });
  }

  async updateSettings(userId: string, data: any): Promise<Setting> {
    return this.prisma.setting.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data,
      },
    });
  }

  async updateLastActive(id: string, lastActive: Date): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { lastActive },
    });
  }
}
