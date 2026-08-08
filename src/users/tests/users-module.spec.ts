import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { validate } from 'class-validator';
import { AppModule } from '../../app.module';
import { UsersService } from '../services/users.service';
import { UsersRepository } from '../repositories/users.repository';
import { PrismaService } from '../../database/prisma.service';
import { IEventBus } from '../../telegram/interfaces/event-bus.interface';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';
import { UpdateSettingsDto } from '../dto/update-settings.dto';
import { UserProfileUpdatedEvent, UserPreferencesUpdatedEvent, UserSettingsUpdatedEvent } from '../events/user-events';
import { CustomLogger } from '../../common/logger/custom-logger.service';

process.env.NODE_ENV = 'test';
process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

async function runTests() {
  console.log('==================================================');
  console.log('🧪 Starting Enterprise Users Module Integration Tests');
  console.log('==================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const usersService = app.get(UsersService);
  const usersRepository = app.get(UsersRepository);
  const eventBus = app.get(IEventBus);
  const logger = app.get(CustomLogger);

  logger.setContext('UsersIntegrationTests');

  // Setup Test User in DB
  const testTelegramId = 88887777n;
  const testUserUuid = '55555555-4444-3333-2222-111111111111';

  // Cleanup existing entries to ensure clean run
  const prismaAny = prisma as any;
  await prismaAny.userPreference.deleteMany({ where: { userId: testUserUuid } });
  await prismaAny.setting.deleteMany({ where: { userId: testUserUuid } });
  await prismaAny.vaultFile.deleteMany({ where: { userId: testUserUuid } });
  await prismaAny.user.deleteMany({ where: { id: testUserUuid } });

  // Create clean user
  await prisma.user.create({
    data: {
      id: testUserUuid,
      telegramId: testTelegramId,
      firstName: 'Alice',
      lastName: 'Smith',
      username: 'alicesmith',
      status: 'ACTIVE',
    },
  });

  // Create mock Vault File for avatar referencing
  const mockVaultFileId = '77777777-6666-5555-4444-333333333333';
  await prismaAny.vaultFile.create({
    data: {
      id: mockVaultFileId,
      userId: testUserUuid,
      name: 'avatar.png',
      storagePath: '/uploads/avatar.png',
      fileSize: 1024n,
      extension: 'png',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      status: 'READY',
    },
  });

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASSED: ${message}`);
      passed++;
    } else {
      console.log(`❌ FAILED: ${message}`);
      failed++;
    }
  }

  try {
    // ──────── Test 1: Profile Retrieval & Default Fields ────────
    const profile = await usersService.getUserProfile(testUserUuid);
    assert(profile.firstName === 'Alice', 'Should retrieve correct firstName');
    assert(profile.lastName === 'Smith', 'Should retrieve correct lastName');
    assert(profile.username === 'alicesmith', 'Should retrieve correct username');
    assert(profile.timezone === 'UTC', 'Should fall back to default UTC timezone');

    // ──────── Test 2: Profile Update & Cache Invalidation ────────
    // Listen to the update event
    let profileEventReceived: any = null;
    eventBus.subscribe(UserProfileUpdatedEvent.eventName, async (payload: any) => {
      profileEventReceived = payload;
    });

    const updateProfileDto: UpdateProfileDto = {
      firstName: 'Alisha',
      lastName: 'Doe',
      bio: 'Enterprise DevMate user profile bio text.',
      country: 'US', // ISO code
      avatarFileId: mockVaultFileId,
    };

    const updatedProfile = await usersService.updateProfile(testUserUuid, updateProfileDto);
    assert(updatedProfile.firstName === 'Alisha', 'Should update firstName');
    assert(updatedProfile.lastName === 'Doe', 'Should update lastName');
    assert(updatedProfile.bio === 'Enterprise DevMate user profile bio text.', 'Should update bio');
    assert(updatedProfile.country === 'US', 'Should update country to US');
    assert(updatedProfile.avatarFileId === mockVaultFileId, 'Should set avatar reference to VaultFile ID');

    // Verify event bus payload
    assert(profileEventReceived !== null, 'Should emit UserProfileUpdated event');
    assert(profileEventReceived?.firstName === 'Alisha', 'Event payload should contain updated fields');
    assert(profileEventReceived?.avatarFileId === mockVaultFileId, 'Event payload should contain vault file ID');

    // ──────── Test 3: Username Rules Normalization & Restrictions ────────
    // Test Case: Reserved Username rejection
    try {
      await usersService.updateProfile(testUserUuid, { username: 'admin' });
      assert(false, 'Should fail to set reserved username "admin"');
    } catch (err: any) {
      assert(err.message.includes('reserved'), 'Should block reserved username with correct error message');
    }

    // Test Case: Lowercase Normalization
    const mixedUsernameDto: UpdateProfileDto = { username: 'ALICE_SuperUser' };
    const lowercaseProfile = await usersService.updateProfile(testUserUuid, mixedUsernameDto);
    assert(lowercaseProfile.username === 'alice_superuser', 'Should normalize username to lowercase');

    // Test Case: Uniqueness Check
    // Create another user
    const otherUserUuid = '99999999-8888-7777-6666-555555555555';
    await prisma.user.create({
      data: {
        id: otherUserUuid,
        telegramId: 11112222n,
        firstName: 'Bob',
        username: 'bobthebuilder',
      },
    });

    try {
      await usersService.updateProfile(testUserUuid, { username: 'bobthebuilder' });
      assert(false, 'Should fail to set non-unique username');
    } catch (err: any) {
      assert(err.message.includes('already taken'), 'Should reject duplicate username');
    }

    // Test Case: 30-day limitation
    // Try to change username again immediately
    try {
      await usersService.updateProfile(testUserUuid, { username: 'alice_thirdname' });
      assert(false, 'Should block changing username twice within 30 days');
    } catch (err: any) {
      assert(err.message.includes('once every 30 days'), 'Should enforce 30-day change cooldown policy');
    }

    // Clean up Bob
    await prismaAny.user.delete({ where: { id: otherUserUuid } });

    // ──────── Test 4: Preferences Update & DTO Validation ────────
    // DTO Validation: Test Timezone validation
    const badPrefDto = new UpdatePreferencesDto();
    badPrefDto.timezone = 'Invalid/Zone';
    badPrefDto.baseCurrency = 'XYZ' as any; // Invalid ISO code
    let valErrors = await validate(badPrefDto);
    assert(valErrors.length > 0, 'Validation should fail for invalid timezone and currency');

    const goodPrefDto = new UpdatePreferencesDto();
    goodPrefDto.timezone = 'Europe/Paris';
    goodPrefDto.baseCurrency = 'EUR';
    goodPrefDto.theme = 'DARK';
    goodPrefDto.language = 'ES';
    goodPrefDto.dateFormat = 'YYYY_MM_DD';
    goodPrefDto.timeFormat = 'H24';
    goodPrefDto.measurementUnits = 'METRIC';
    goodPrefDto.weekStartDay = 'MONDAY';
    goodPrefDto.notificationPreferences = {
      email: true,
      push: false,
      telegram: true,
      dailySummary: false,
    };

    let prefEventReceived: any = null;
    eventBus.subscribe(UserPreferencesUpdatedEvent.eventName, async (payload: any) => {
      prefEventReceived = payload;
    });

    const updatedPref = await usersService.updatePreferences(testUserUuid, goodPrefDto);
    assert(updatedPref.timezone === 'Europe/Paris', 'Should update timezone to Europe/Paris');
    assert(updatedPref.baseCurrency === 'EUR', 'Should update baseCurrency to EUR');
    assert(updatedPref.theme === 'DARK', 'Should update theme');
    assert(updatedPref.language === 'ES', 'Should update language');
    assert(updatedPref.notificationPreferences.push === false, 'Should update notification jsonb values');

    assert(prefEventReceived !== null, 'Should emit UserPreferencesUpdated event');
    assert(prefEventReceived?.preferences.timezone === 'Europe/Paris', 'Event preferences timezone should be correct');

    // ──────── Test 5: Settings Update & DTO Validation ────────
    // DTO Validation: Test HH:MM format matching
    const badSettingsDto = new UpdateSettingsDto();
    badSettingsDto.quietHoursStart = '26:00'; // Bad hours
    badSettingsDto.summaryTime = '08:99'; // Bad minutes
    valErrors = await validate(badSettingsDto);
    assert(valErrors.length > 0, 'Validation should fail for invalid HH:MM times');

    const goodSettingsDto = new UpdateSettingsDto();
    goodSettingsDto.quietHoursStart = '22:00';
    goodSettingsDto.quietHoursEnd = '06:00';
    goodSettingsDto.summaryTime = '09:00';
    goodSettingsDto.notifyEnabled = true;
    goodSettingsDto.privacySettings = {
      showProfilePhoto: false,
      shareSplitHistory: false,
    };
    goodSettingsDto.securitySettings = {
      twoFactorEnabled: true,
      loginAlertsEnabled: true,
    };
    goodSettingsDto.telegramPreferences = {
      inlineResultsLimit: 25,
      autoDownloadMedia: false,
    };
    goodSettingsDto.aiPreferences = {
      modelName: 'claude-3.5',
      temperature: 0.2,
    };

    let settingsEventReceived: any = null;
    eventBus.subscribe(UserSettingsUpdatedEvent.eventName, async (payload: any) => {
      settingsEventReceived = payload;
    });

    const updatedSettings = await usersService.updateSettings(testUserUuid, goodSettingsDto);
    assert(updatedSettings.quietHoursStart === '22:00', 'Should update quietHoursStart');
    assert(updatedSettings.summaryTime === '09:00', 'Should update summaryTime');
    assert(updatedSettings.privacySettings.showProfilePhoto === false, 'Should update privacy settings');
    assert(updatedSettings.aiPreferences.modelName === 'claude-3.5', 'Should update AI preferences');

    assert(settingsEventReceived !== null, 'Should emit UserSettingsUpdated event');
    assert(settingsEventReceived?.settings.aiPreferences.temperature === 0.2, 'Event payload should contain AI temperature');

    // ──────── Test 6: Auth Layer lastActive update ────────
    const lastActiveBefore = (await prisma.user.findUnique({ where: { id: testUserUuid } }))?.lastActive;
    assert(lastActiveBefore === null, 'lastActive should start as null');

    await usersService.updateLastActive(testUserUuid);

    const lastActiveAfter = (await prisma.user.findUnique({ where: { id: testUserUuid } }))?.lastActive;
    assert(lastActiveAfter !== null, 'lastActive should be populated after Auth layer trigger');

  } catch (error) {
    console.error('❌ Test execution encountered an unhandled error:', error);
    failed++;
  } finally {
    // Cleanup Database test entries
    await prismaAny.userPreference.deleteMany({ where: { userId: testUserUuid } });
    await prismaAny.setting.deleteMany({ where: { userId: testUserUuid } });
    await prismaAny.vaultFile.deleteMany({ where: { userId: testUserUuid } });
    await prismaAny.user.deleteMany({ where: { id: testUserUuid } });

    await app.close();
  }

  console.log('\n==================================================');
  console.log(`🏁 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
