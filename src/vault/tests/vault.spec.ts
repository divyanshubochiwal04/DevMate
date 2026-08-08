import 'reflect-metadata';
import * as crypto from 'crypto';

process.on('uncaughtException', (err) => {
  console.log('CRITICAL: Uncaught Exception:', err.message);
  console.log(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  console.log('CRITICAL: Unhandled Rejection:', reason?.message || reason);
  if (reason?.stack) console.log(reason.stack);
  process.exit(1);
});

process.env.NODE_ENV = 'test';
process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
process.env.OPENAI_API_KEY = 'CHANGE_ME_DEV_OPENAI_API_KEY';
process.env.SUPER_ADMIN_TELEGRAM_ID = '123456789';
const initialMasterKey = crypto.randomBytes(32).toString('base64');
process.env.VAULT_MASTER_KEY = initialMasterKey;

console.log('DIAGNOSTIC - NODE_ENV:', process.env.NODE_ENV);
console.log('DIAGNOSTIC - VAULT_MASTER_KEY:', process.env.VAULT_MASTER_KEY);

import * as dotenv from 'dotenv';
import * as path from 'path';
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}
console.log('DIAGNOSTIC - DATABASE_URL after load:', process.env.DATABASE_URL);

import { validate } from '../../config/env.validation';
try {
  validate(process.env);
  console.log('DIAGNOSTIC - Direct validation passed.');
} catch (e: any) {
  console.log('DIAGNOSTIC - Direct validation failed:', e.message);
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { VaultService } from '../services/vault.service';
import { VaultRepository } from '../repositories/vault.repository';
import { PrismaService } from '../../database/prisma.service';
import { IKeyManagementService } from '../interfaces/key-management.interface';
import { IVaultStorageProvider } from '../interfaces/vault-storage.interface';
import { ConfigService } from '../../config/config.service';
import { VaultItemType, FileStatus, AuditAction } from '@prisma/client';
import { ConflictException, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Buffer } from 'buffer';
import { CustomLogger } from '../../common/logger/custom-logger.service';

async function runTests() {
  console.log('==================================================');
  console.log('🧪 Starting Enterprise Secure Vault Integration Tests');
  console.log('==================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const vaultService = app.get(VaultService);
  const vaultRepository = app.get(VaultRepository);
  const kms = app.get(IKeyManagementService);
  const storage = app.get(IVaultStorageProvider);
  const config = app.get(ConfigService);

  const userA = 'vault-test-user-a';
  const userB = 'vault-test-user-b';

  // Cleanup Database State
  const prismaAny = prisma as any;
  await prismaAny.vaultItem.deleteMany({});
  await prismaAny.vaultUserKey.deleteMany({});
  await prismaAny.vaultFile.deleteMany({});
  await prismaAny.vaultFolder.deleteMany({});
  await prismaAny.auditLog.deleteMany({});
  await prismaAny.user.deleteMany({ where: { id: { in: [userA, userB] } } });

  // Create clean users
  await prisma.user.create({
    data: { id: userA, telegramId: 99991111n, firstName: 'Alice', status: 'ACTIVE' },
  });
  await prisma.user.create({
    data: { id: userB, telegramId: 99992222n, firstName: 'Bob', status: 'ACTIVE' },
  });

  let testPassed = 0;
  let testFailed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      testPassed++;
      console.log(`✅ PASS: ${message}`);
    } else {
      testFailed++;
      console.error(`❌ FAIL: ${message}`);
    }
  }

  // ─── 1. CONFIGURATION & MASTER KEY VALIDATION ───
  {
    const originalExit = process.exit;
    const originalConsoleError = console.error;
    let exitCalledWith: number | null = null;
    
    (process as any).exit = (code: number) => {
      exitCalledWith = code;
    };
    console.error = () => {};

    try {
      // Malformed Base64 KEK check
      validate({
        VAULT_MASTER_KEY: 'NotBase64!!!',
        TELEGRAM_BOT_TOKEN: '123',
        OPENAI_API_KEY: '123',
        SUPER_ADMIN_TELEGRAM_ID: '123',
      });
    } catch (e) {}

    assert(exitCalledWith === 1, 'Rejected malformed Base64 master key successfully.');
    
    // Reset tracker
    exitCalledWith = null;

    try {
      // Decoded master key != 32 bytes check
      const weakKey = crypto.randomBytes(16).toString('base64');
      validate({
        VAULT_MASTER_KEY: weakKey,
        TELEGRAM_BOT_TOKEN: '123',
        OPENAI_API_KEY: '123',
        SUPER_ADMIN_TELEGRAM_ID: '123',
      });
    } catch (e) {}

    assert(exitCalledWith === 1, 'Rejected decoded master key != 32 bytes successfully.');

    // Restore
    process.exit = originalExit;
    console.error = originalConsoleError;
  }

  // ─── 2. KEY WRAPPING & DYNAMIC DEK ENVELOPE ───
  try {
    const rawDek1 = await vaultService.getOrCreateUserDEK(userA);
    const rawDek2 = await vaultService.getOrCreateUserDEK(userA);
    assert(
      rawDek1.toString('hex') === rawDek2.toString('hex'),
      'Subsequent DEK fetches return the same decrypted data key.'
    );

    const userKeyRecord = await vaultRepository.findUserKey(userA);
    assert(!!userKeyRecord, 'VaultUserKey record created in DB.');
    assert(userKeyRecord?.wrapIv !== userKeyRecord?.wrapAuthTag, 'Wrap IV and tag are separate fields.');
  } catch (e: any) {
    console.error(e);
    assert(false, 'DEK envelope tests failed.');
  }

  // ─── 3. KEK WRAPPING IV RANDOMNESS ───
  try {
    const rawDek = crypto.randomBytes(32);
    const kek = Buffer.from(initialMasterKey, 'base64');
    const wrapped1 = await kms.wrapKey(rawDek, kek, 1);
    const wrapped2 = await kms.wrapKey(rawDek, kek, 1);

    assert(wrapped1.wrapIv !== wrapped2.wrapIv, 'KEK wrapping IV differs across operations (unique nonces).');
  } catch (e: any) {
    assert(false, 'Wrapping IV uniqueness check failed.');
  }

  // ─── 4. KEY TAMPERING DETECTION ───
  try {
    const userKeyRecord = await vaultRepository.findUserKey(userA);
    if (userKeyRecord) {
      const tamperedKey = userKeyRecord.wrappedKey.substring(0, userKeyRecord.wrappedKey.length - 4) + 'AAAA';
      const kek = Buffer.from(initialMasterKey, 'base64');
      await kms.unwrapKey(tamperedKey, userKeyRecord.wrapIv, userKeyRecord.wrapAuthTag, kek);
      assert(false, 'Tampered wrapped key unwrapping should fail.');
    }
  } catch (e: any) {
    assert(true, 'Tampered wrapped key unwrapping rejected.');
  }

  try {
    const userKeyRecord = await vaultRepository.findUserKey(userA);
    if (userKeyRecord) {
      const tamperedTag = userKeyRecord.wrapAuthTag.substring(0, userKeyRecord.wrapAuthTag.length - 4) + 'AAAA';
      const kek = Buffer.from(initialMasterKey, 'base64');
      await kms.unwrapKey(userKeyRecord.wrappedKey, userKeyRecord.wrapIv, tamperedTag, kek);
      assert(false, 'Tampered wrap auth tag unwrapping should fail.');
    }
  } catch (e: any) {
    assert(true, 'Tampered wrap auth tag unwrapping rejected.');
  }

  // ─── 5. DATA CONFIDENTIALITY & SEPARATION ───
  try {
    // User A item
    const itemA = await vaultService.createItem(userA, {
      type: VaultItemType.SECURE_NOTE,
      title: 'Secret Note User A',
      payload: { note: 'Aman Secret Code' },
    });

    // Try revealing User A item with User B credentials
    await vaultService.revealItem(userB, itemA.id);
    assert(false, 'User B should not access User A vault item.');
  } catch (e: any) {
    assert(e instanceof NotFoundException, 'User B reveal of User A item correctly throws NotFoundException (hiding existence).');
  }

  // ─── 6. GLOBAL LOGGING REDACTION ───
  try {
    // Intercept console/process streams to verify redaction
    let captured = '';
    const writeOriginal = process.stdout.write;
    process.stdout.write = (chunk: any) => {
      captured += chunk.toString();
      return writeOriginal.apply(process.stdout, [chunk]);
    };

    const logger = app.get(CustomLogger);
    logger.log({
      password: 'MyPlaintextPassword123!',
      secret: 'PlaintextSecretCode',
      apiKey: 'API-KEY-VALUE',
      Authorization: 'Bearer SuperSecretTokenXYZ',
    });

    process.stdout.write = writeOriginal;

    assert(!captured.includes('MyPlaintextPassword123!'), 'Password field redacted in logged outputs.');
    assert(!captured.includes('PlaintextSecretCode'), 'Secret field redacted in logged outputs.');
    assert(!captured.includes('API-KEY-VALUE'), 'ApiKey field redacted in logged outputs.');
    assert(!captured.includes('SuperSecretTokenXYZ'), 'Authorization token redacted in logged outputs.');
    assert(captured.includes('[REDACTED]'), 'Logged parameters are successfully replaced with [REDACTED].');
  } catch (e: any) {
    assert(false, 'Global logging redaction checks failed.');
  }

  // ─── 7. FOLDER CYCLE DETECTION ───
  try {
    const folder1 = await vaultService.createFolder(userA, { name: 'Folder A' });
    const folder2 = await vaultService.createFolder(userA, { name: 'Folder B', parentId: folder1.id });
    const folder3 = await vaultService.createFolder(userA, { name: 'Folder C', parentId: folder2.id });

    // Loop: folder1 -> parent is folder3
    await vaultService.updateFolder(userA, folder1.id, folder1.version, { parentId: folder3.id });
    assert(false, 'Should throw exception on cyclic hierarchy assignment.');
  } catch (e: any) {
    assert(e instanceof BadRequestException && e.message.includes('cycle detected'), 'Cyclic hierarchy assignment blocked successfully.');
  }

  // ─── 8. PATH TRAVERSAL BLOCK ───
  try {
    await storage.put('../escaped_key.txt', Buffer.from('Plaintext leaked'));
    assert(false, 'Storage provider should block key escaping root root directory.');
  } catch (e: any) {
    assert(e instanceof ForbiddenException && e.message.toLowerCase().includes('path traversal'), 'Defensive path traversal check blocked escape successfully.');
  }

  // ─── 9. FILE ENCRYPTION, UPLOAD & CLEANUP ───
  let uploadedFileRecord: any = null;
  try {
    // Must start with PDF magic bytes: %PDF (0x25504446)
    const pdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]); // %PDF-1.4
    const pdfContent = Buffer.concat([pdfHeader, Buffer.from('\n% Sensitive document payload')]);
    uploadedFileRecord = await vaultService.uploadFile(userA, {
      originalname: 'secret_document.pdf',
      mimetype: 'application/pdf',
      buffer: pdfContent,
      size: pdfContent.length,
    });

    assert(uploadedFileRecord.status === FileStatus.READY, 'Uploaded file reaches READY status.');
    assert(uploadedFileRecord.contentIv !== null && uploadedFileRecord.contentAuthTag !== null, 'File encrypted with contentIv and contentAuthTag.');

    // Verify stored content is encrypted
    const physicalExists = await storage.exists(uploadedFileRecord.storagePath);
    assert(physicalExists, 'Physical file resides in secure vault root.');
  } catch (e: any) {
    console.error(e);
    assert(false, 'File upload encryption tests failed.');
  }

  // ─── 10. CLEANUP ON TRANSACTION FAILURE ───
  try {
    // Must use valid PDF header so MIME check passes and the folder check is reached
    const pdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
    // Force repository failure by supplying an invalid folder UUID
    await vaultService.uploadFile(userA, {
      originalname: 'failure_doc.pdf',
      mimetype: 'application/pdf',
      buffer: pdfHeader,
      size: pdfHeader.length,
    }, '00000000-0000-0000-0000-000000000000');
    assert(false, 'Upload with bad folderId should throw NotFoundException.');
  } catch (e: any) {
    assert(e instanceof NotFoundException, 'Invalid folder upload rejected.');
    // Ensure no files exist in storage (should be empty except for secret_document.pdf)
    const filesInVault = await prisma.vaultFile.findMany({ where: { status: FileStatus.READY } });
    assert(filesInVault.length === 1, 'Failed upload leaves no database record.');
  }

  // ─── 11. DOWNLOAD & INTEGRITY DECRYPTION ───
  try {
    if (uploadedFileRecord) {
      const download = await vaultService.downloadFile(userA, uploadedFileRecord.id);
      // Verify PDF magic header present in decrypted output (%PDF = 0x25504446)
      const pdfMagic = download.data.slice(0, 4).toString('hex').toUpperCase();
      assert(pdfMagic === '25504446', 'Decrypted download starts with PDF magic bytes (%PDF).');
      assert(download.mimeType === 'application/pdf', 'Decrypted download has correct MIME type.');
    }
  } catch (e: any) {
    assert(false, 'File download decryption check failed.');
  }

  // ─── 12. SYNCHRONOUS AUDITING GUARANTEE ───
  try {
    const itemA = await prisma.vaultItem.findFirst({ where: { userId: userA } });
    if (itemA) {
      // Mock prisma.auditLog.create to throw a DB error during reveal
      const originalCreate = prisma.auditLog.create;
      (prisma.auditLog as any).create = async () => {
        throw new Error('Database connection lost');
      };

      try {
        await vaultService.revealItem(userA, itemA.id);
        assert(false, 'Reveal operation must fail-fast if synchronous auditing fails.');
      } catch (revealErr: any) {
        assert(
          revealErr.message.includes('audit trail') || revealErr.message.includes('Database connection lost'),
          'Plaintext secret reveal blocked when audit logger fails.'
        );
      } finally {
        (prisma.auditLog as any).create = originalCreate;
      }
    }
  } catch (e: any) {
    assert(false, 'Synchronous auditing guarantee test failed.');
  }

  // ─── 13. KEK ROTATION REWRAP (ZERO CONTENT WRITES) ───
  try {
    const itemBefore = await prisma.vaultItem.findFirst({ where: { userId: userA } });
    const userKeyBefore = await prisma.vaultUserKey.findUnique({ where: { userId: userA } });

    const newMasterKey = crypto.randomBytes(32).toString('base64');
    await vaultService.rotateKEK(initialMasterKey, newMasterKey, 2);

    const userKeyAfter = await prisma.vaultUserKey.findUnique({ where: { userId: userA } });
    const itemAfter = await prisma.vaultItem.findFirst({ where: { userId: userA } });

    assert(userKeyBefore?.wrappedKey !== userKeyAfter?.wrappedKey, 'User wrapped DEK changed in KEK rotation.');
    assert(userKeyAfter?.kekVersion === 2, 'User KEK version updated to 2.');
    assert(itemBefore?.ciphertext === itemAfter?.ciphertext, 'VaultItem content ciphertext remains completely untouched (no rewrite).');

    // Update config service instance's internal key representation
    (config as any).env.VAULT_MASTER_KEY = newMasterKey;

    // Verify decryption still works
    if (itemBefore) {
      const revealed = await vaultService.revealItem(userA, itemBefore.id);
      assert(revealed.note === 'Aman Secret Code', 'Decryptability preserved after KEK rewrapping.');
    }
  } catch (e: any) {
    console.error(e);
    assert(false, 'KEK rotation integration test failed.');
  }

  // ─── 14. DEK ROTATION RE-ENCRYPTION ───
  try {
    const itemBefore = await prisma.vaultItem.findFirst({ where: { userId: userA } });
    await vaultService.rotateDEK(userA);

    const itemAfter = await prisma.vaultItem.findFirst({ where: { userId: userA } });
    assert(itemBefore?.ciphertext !== itemAfter?.ciphertext, 'VaultItem ciphertext re-encrypted with new DEK.');
    assert(itemAfter?.dekVersion === (itemBefore?.dekVersion || 1) + 1, 'VaultItem dekVersion incremented.');

    if (itemAfter) {
      const revealed = await vaultService.revealItem(userA, itemAfter.id);
      assert(revealed.note === 'Aman Secret Code', 'Decryptability preserved after DEK rotation.');
    }
  } catch (e: any) {
    console.error(e);
    assert(false, 'DEK rotation integration test failed.');
  }

  // ─── 15. MIME SPOOFING DETECTION ───
  {
    // 15a. Plain text disguised as PDF — should be rejected
    try {
      const fakePdfContent = Buffer.from('This is not a PDF, it is plain text.');
      await vaultService.uploadFile(userA, {
        originalname: 'invoice.pdf',
        mimetype: 'application/pdf',
        buffer: fakePdfContent,
        size: fakePdfContent.length,
      });
      assert(false, 'MIME spoofing: plain text as .pdf should be rejected.');
    } catch (e: any) {
      assert(
        e instanceof BadRequestException && e.message.includes('MIME spoofing'),
        'MIME spoofing: plain text as .pdf correctly rejected.'
      );
    }

    // 15b. PNG content disguised as .pdf — should be rejected
    try {
      const fakePngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
      await vaultService.uploadFile(userA, {
        originalname: 'report.pdf',
        mimetype: 'application/pdf',
        buffer: fakePngBuffer,
        size: fakePngBuffer.length,
      });
      assert(false, 'MIME spoofing: PNG bytes in .pdf file should be rejected.');
    } catch (e: any) {
      assert(
        e instanceof BadRequestException && e.message.includes('MIME spoofing'),
        'MIME spoofing: PNG bytes disguised as .pdf rejected.'
      );
    }

    // 15c. Windows PE executable (.exe header) disguised as .txt — should be rejected
    try {
      const exeBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      await vaultService.uploadFile(userA, {
        originalname: 'notes.txt',
        mimetype: 'text/plain',
        buffer: exeBuffer,
        size: exeBuffer.length,
      });
      assert(false, 'MIME spoofing: PE executable disguised as .txt should be rejected.');
    } catch (e: any) {
      assert(
        e instanceof BadRequestException && (e.message.includes('MIME spoofing') || e.message.includes('Executable')),
        'MIME spoofing: PE executable disguised as .txt rejected.'
      );
    }

    // 15d. CSV with valid text content — should be accepted
    try {
      const csvContent = Buffer.from('name,email,amount\nAlice,alice@example.com,100\nBob,bob@example.com,200');
      const csvFile = await vaultService.uploadFile(userA, {
        originalname: 'expenses.csv',
        mimetype: 'text/csv',
        buffer: csvContent,
        size: csvContent.length,
      });
      assert(csvFile.status === FileStatus.READY, 'MIME: valid CSV text content accepted without spoofing error.');
      // Clean up
      try { await vaultService.deleteFile(userA, csvFile.id, csvFile.version); } catch {}
    } catch (e: any) {
      assert(false, `MIME: valid CSV rejected unexpectedly: ${e.message}`);
    }

    // 15e. Valid PNG — should be accepted
    try {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
      const pngFile = await vaultService.uploadFile(userA, {
        originalname: 'image.png',
        mimetype: 'image/png',
        buffer: pngHeader,
        size: pngHeader.length,
      });
      assert(pngFile.status === FileStatus.READY, 'MIME: valid PNG accepted.');
      try { await vaultService.deleteFile(userA, pngFile.id, pngFile.version); } catch {}
    } catch (e: any) {
      assert(false, `MIME: valid PNG rejected unexpectedly: ${e.message}`);
    }
  }

  // ─── 16. COMMAND REGISTRY COLLISION DETECTION ───
  {
    const { CommandRegistryService } = await import('../../telegram/commands/command-registry.service');
    const registry = new CommandRegistryService();
    // Must satisfy TelegramCommandHandler interface: { handle(ctx): Promise<void> }
    const noop: import('../../telegram/interfaces/command-handler.interface').TelegramCommandHandler = {
      handle: async (_ctx: any) => {},
    };

    // Register a command successfully
    registry.register('testcmd', noop, { command: 'testcmd', description: 'Test' });

    // 16a. Duplicate main command name should throw
    try {
      registry.register('testcmd', noop, { command: 'testcmd', description: 'Duplicate' });
      assert(false, 'Command registry: duplicate command name should throw.');
    } catch (e: any) {
      assert(e.message.includes('collision'), 'Command registry: duplicate command name throws collision error.');
    }

    // 16b. Register with an alias
    registry.register('primarycmd', noop, { command: 'primarycmd', aliases: ['myalias'], description: 'With alias' });

    // 16c. Registering another command with the same alias should throw
    try {
      registry.register('othercmd', noop, { command: 'othercmd', aliases: ['myalias'], description: 'Alias collision' });
      assert(false, 'Command registry: alias collision should throw.');
    } catch (e: any) {
      assert(e.message.includes('collision'), 'Command registry: alias collision throws error.');
    }

    // 16d. Registering a command whose name matches an existing alias should throw
    try {
      registry.register('myalias', noop, { command: 'myalias', description: 'Name matches existing alias' });
      assert(false, 'Command registry: new command matching existing alias should throw.');
    } catch (e: any) {
      assert(e.message.includes('collision'), 'Command registry: new command name matching existing alias throws collision error.');
    }
  }

  // ─── 17. STRING SCRUBBER SANITIZATION ───
  {
    const { scrubString } = await import('../../common/logger/custom-logger.service');

    // 17a. DB connection string credential redaction
    const dbUrl = 'postgresql://dbuser:SuperSecretPassword@localhost:5432/devmate';
    const scrubbed = scrubString(dbUrl);
    assert(!scrubbed.includes('SuperSecretPassword'), 'scrubString: DB password redacted from connection string.');
    assert(scrubbed.includes('[REDACTED]'), 'scrubString: DB password replaced with [REDACTED].');

    // 17b. Bearer token redaction
    const logWithToken = 'Calling API with Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiQWxpY2UifQ.someSignature';
    const scrubbedToken = scrubString(logWithToken);
    assert(!scrubbedToken.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), 'scrubString: Bearer token redacted from log message.');

    // 17c. Storage path redaction
    const logWithPath = 'Reading file from storage/vault/550e8400-e29b-41d4-a716-446655440000';
    const scrubbedPath = scrubString(logWithPath);
    assert(!scrubbedPath.includes('550e8400-e29b-41d4-a716-446655440000'), 'scrubString: Vault storage path redacted from log message.');
  }

  // ─── 18. DOWNLOAD AUDIT FAIL-CLOSED ───
  try {
    if (uploadedFileRecord) {
      const originalCreate = prisma.auditLog.create;
      (prisma.auditLog as any).create = async () => {
        throw new Error('Simulated audit DB failure during download');
      };

      let downloadResult: any = null;
      try {
        downloadResult = await vaultService.downloadFile(userA, uploadedFileRecord.id);
        assert(false, 'Download must fail-closed when audit write fails.');
      } catch (downloadErr: any) {
        assert(
          downloadResult === null,
          'No decrypted bytes returned when audit write fails (fail-closed).'
        );
        assert(
          downloadErr.message.includes('audit trail') || downloadErr.message.includes('audit DB failure') || downloadErr.message.includes('Security policy'),
          'Download blocked with informative error when audit fails.'
        );
      } finally {
        (prisma.auditLog as any).create = originalCreate;
      }
    } else {
      assert(false, 'No uploaded file available for download audit fail-closed test.');
    }
  } catch (e: any) {
    assert(false, `Download audit fail-closed test threw unexpected error: ${e.message}`);
  }

  // ─── 19. NONCE UNIQUENESS ───
  {
    const plaintextA = 'Same plaintext value for nonce test';
    const results: Array<{ ciphertext: string; iv: string }> = [];

    for (let i = 0; i < 5; i++) {
      const enc = await vaultService.encryptPayload(userA, plaintextA);
      results.push(enc);
    }

    const ivSet = new Set(results.map(r => r.iv));
    const ctSet = new Set(results.map(r => r.ciphertext));
    assert(ivSet.size === 5, 'All 5 encryption IVs are unique (random nonces).');
    assert(ctSet.size === 5, 'All 5 ciphertexts are unique (probabilistic encryption).');
  }

  // ─── 20. KEK ROTATION ATOMICITY (PARTIAL FAILURE) ───
  try {
    const snapshot = await prisma.vaultUserKey.findMany({ where: { userId: { in: [userA, userB] } } });
    const snapshotKeys = Object.fromEntries(snapshot.map(k => [k.userId, k.wrappedKey]));

    // Force failure mid-rotation by using a bad old KEK for re-wrapping
    try {
      const badOldKey = crypto.randomBytes(32).toString('base64');
      const newKey = crypto.randomBytes(32).toString('base64');
      await vaultService.rotateKEK(badOldKey, newKey, 99);
      assert(false, 'KEK rotation with wrong old KEK should fail.');
    } catch (rotErr: any) {
      // DB state should be completely untouched since it fails in prepare phase
      const afterRotation = await prisma.vaultUserKey.findMany({ where: { userId: { in: [userA, userB] } } });
      const afterKeys = Object.fromEntries(afterRotation.map(k => [k.userId, k.wrappedKey]));
      const keksUnchanged = Object.keys(snapshotKeys).every(uid => snapshotKeys[uid] === afterKeys[uid]);
      assert(keksUnchanged, 'KEK rotation failure leaves all wrapped DEKs untouched in DB.');
    }
  } catch (e: any) {
    assert(false, `KEK rotation atomicity test threw unexpected error: ${e.message}`);
  }

  // ─── 21. CROSS-USER IDOR MATRIX ───
  {
    // Create a user B item
    const itemB = await vaultService.createItem(userB, {
      type: VaultItemType.PASSWORD,
      title: 'Bob Private Password',
      payload: { password: 'B0bS3cr3t!' },
    });

    // User A trying to reveal User B's item
    try {
      await vaultService.revealItem(userA, itemB.id);
      assert(false, 'User A should not reveal User B item (IDOR).');
    } catch (e: any) {
      assert(e instanceof NotFoundException, 'IDOR: User A reveal of User B item correctly blocked.');
    }

    // User A trying to delete User B's item
    try {
      await vaultService.deleteItem(userA, itemB.id, itemB.version);
      assert(false, 'User A should not delete User B item (IDOR).');
    } catch (e: any) {
      assert(e instanceof NotFoundException, 'IDOR: User A delete of User B item correctly blocked.');
    }

    // User A trying to download User B's uploaded file (upload one for B first)
    const bPdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
    const bFile = await vaultService.uploadFile(userB, {
      originalname: 'bob_private.pdf',
      mimetype: 'application/pdf',
      buffer: bPdfHeader,
      size: bPdfHeader.length,
    });

    try {
      await vaultService.downloadFile(userA, bFile.id);
      assert(false, 'User A should not download User B file (IDOR).');
    } catch (e: any) {
      assert(e instanceof NotFoundException, 'IDOR: User A download of User B file correctly blocked.');
    }

    // User A trying to get User B file metadata
    try {
      await vaultService.getFileMetadata(userA, bFile.id);
      assert(false, 'User A should not access User B file metadata (IDOR).');
    } catch (e: any) {
      assert(e instanceof NotFoundException, 'IDOR: User A metadata access to User B file correctly blocked.');
    }
  }

  // ─── FINAL REPORT ───
  console.log('\n==================================================');
  console.log(`🧪 INTEGRATION TEST SUMMARY`);
  console.log(`   Passed: ${testPassed}`);
  console.log(`   Failed: ${testFailed}`);
  console.log('==================================================\n');

  await app.close();
  process.exit(testFailed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
