import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VaultService } from '../services/vault.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { Permission } from '../../rbac/permissions/permission.constants';
import { VaultItemType } from '@prisma/client';
import { IsString, IsOptional, IsEnum, IsInt, IsUUID, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Response } from 'express';
import { BypassTransform } from '../../common/decorators/bypass-transform.decorator';

// ─── DTOs ───

export class CreateFolderDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateFolderDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsInt()
  version!: number;
}

export class CreateVaultItemDto {
  @IsEnum(VaultItemType)
  type!: VaultItemType;

  @IsString()
  title!: string;

  @IsOptional()
  @IsUUID()
  folderId?: string;

  @IsOptional()
  payload: any; // Can be secure notes string, credentials JSON, etc.
}

export class UpdateVaultItemDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsUUID()
  folderId?: string | null;

  @IsOptional()
  payload?: any;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsInt()
  version!: number;
}

export class DeleteFolderDto {
  @IsInt()
  version!: number;
}

export class DeleteItemDto {
  @IsInt()
  version!: number;
}

export class RestoreItemDto {
  @IsInt()
  version!: number;
}

export class DeleteFileDto {
  @IsInt()
  version!: number;
}

export class RotateKekDto {
  @IsString()
  oldKekBase64!: string;

  @IsString()
  newKekBase64!: string;

  @IsInt()
  newKekVersion!: number;
}

// ─── Presentation Entities ───

export class VaultFolderEntity {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;

  constructor(model: any) {
    this.id = model.id;
    this.name = model.name;
    this.parentId = model.parentId;
    this.createdAt = model.createdAt;
    this.updatedAt = model.updatedAt;
    this.version = model.version;
  }
}

export class VaultItemEntity {
  id: string;
  type: VaultItemType;
  title: string;
  folderId: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  version: number;

  constructor(model: any) {
    this.id = model.id;
    this.type = model.type;
    this.title = model.title;
    this.folderId = model.folderId;
    this.isFavorite = model.isFavorite;
    this.isPinned = model.isPinned;
    this.createdAt = model.createdAt;
    this.updatedAt = model.updatedAt;
    this.version = model.version;
  }
}

export class VaultItemRevealEntity {
  id: string;
  type: VaultItemType;
  title: string;
  payload: any;

  constructor(model: any, payload: any) {
    this.id = model.id;
    this.type = model.type;
    this.title = model.title;
    this.payload = payload;
  }
}

export class VaultFileEntity {
  id: string;
  name: string;
  fileSize: string;
  extension: string;
  mimeType: string | null;
  status: string;
  folderId: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;

  constructor(model: any) {
    this.id = model.id;
    this.name = model.name;
    this.fileSize = model.fileSize.toString();
    this.extension = model.extension;
    this.mimeType = model.mimeType;
    this.status = model.status;
    this.folderId = model.folderId;
    this.createdAt = model.createdAt;
    this.updatedAt = model.updatedAt;
    this.version = model.version;
  }
}

@Controller('vault')
export class VaultController {
  constructor(private readonly vaultService: VaultService) {}

  // ─── Folders ───

  @Post('folders')
  @RequirePermissions(Permission.VAULT_UPLOAD)
  async createFolder(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFolderDto) {
    const data = await this.vaultService.createFolder(user.id, dto);
    return { success: true, data: new VaultFolderEntity(data) };
  }

  @Get('folders')
  @RequirePermissions(Permission.VAULT_DOWNLOAD)
  async listFolders(@CurrentUser() user: AuthenticatedUser) {
    const folders = await this.vaultService.listFolders(user.id);
    return { success: true, data: folders.map(f => new VaultFolderEntity(f)) };
  }

  @Patch('folders/:id')
  @RequirePermissions(Permission.VAULT_UPDATE)
  async updateFolder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto
  ) {
    const { version, ...rest } = dto;
    const data = await this.vaultService.updateFolder(user.id, id, version, rest);
    return { success: true, data: new VaultFolderEntity(data) };
  }

  @Delete('folders/:id')
  @RequirePermissions(Permission.VAULT_DELETE)
  async deleteFolder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DeleteFolderDto
  ) {
    await this.vaultService.deleteFolder(user.id, id, dto.version);
    return { success: true, message: 'Folder successfully soft-deleted.' };
  }

  // ─── Items (Secrets) ───

  @Post('items')
  @RequirePermissions(Permission.VAULT_UPLOAD)
  async createItem(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVaultItemDto) {
    const data = await this.vaultService.createItem(user.id, dto);
    return { success: true, data: new VaultItemEntity(data) };
  }

  @Get('items')
  @RequirePermissions(Permission.VAULT_DOWNLOAD)
  async listItems(
    @CurrentUser() user: AuthenticatedUser,
    @Query('folderId') folderId?: string,
    @Query('type') type?: VaultItemType
  ) {
    const items = await this.vaultService.listItems(user.id, { folderId, type });
    return { success: true, data: items.map(i => new VaultItemEntity(i)) };
  }

  @Get('items/:id')
  @RequirePermissions(Permission.VAULT_DOWNLOAD)
  async getItemMetadata(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const item = await this.vaultService.getItemMetadata(user.id, id);
    return { success: true, data: new VaultItemEntity(item) };
  }

  @Patch('items/:id')
  @RequirePermissions(Permission.VAULT_UPDATE)
  async updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateVaultItemDto
  ) {
    const { version, ...rest } = dto;
    const data = await this.vaultService.updateItem(user.id, id, version, rest);
    return { success: true, data: new VaultItemEntity(data) };
  }

  @Delete('items/:id')
  @RequirePermissions(Permission.VAULT_DELETE)
  async deleteItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DeleteItemDto
  ) {
    await this.vaultService.deleteItem(user.id, id, dto.version);
    return { success: true, message: 'Item soft-deleted.' };
  }

  @Post('items/:id/restore')
  @RequirePermissions(Permission.VAULT_UPDATE)
  async restoreItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RestoreItemDto
  ) {
    const restored = await this.vaultService.restoreItem(user.id, id, dto.version);
    return { success: true, data: new VaultItemEntity(restored) };
  }

  // ─── Reveal payload (Sensitive read endpoint) ───

  @Post('items/:id/reveal')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.VAULT_DOWNLOAD)
  async revealItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response
  ) {
    // 1. Decrypt plaintext secret
    const payload = await this.vaultService.revealItem(user.id, id);
    const metadata = await this.vaultService.getItemMetadata(user.id, id);

    // 2. Set strict headers to bypass proxy/browser cache
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
      success: true,
      data: new VaultItemRevealEntity(metadata, payload),
    });
  }

  // ─── Vault Files ───

  @Post('files')
  @UseInterceptors(FileInterceptor('file'))
  @RequirePermissions(Permission.VAULT_UPLOAD)
  async uploadFile(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: any,
    @Body('folderId') folderId?: string
  ) {
    if (!file) throw new BadRequestException('No file uploaded.');

    const data = await this.vaultService.uploadFile(user.id, file, folderId);
    return { success: true, data: new VaultFileEntity(data) };
  }

  @Get('files')
  @RequirePermissions(Permission.VAULT_DOWNLOAD)
  async listFiles(@CurrentUser() user: AuthenticatedUser, @Query('folderId') folderId?: string) {
    const files = await this.vaultService.listFiles(user.id, folderId);
    return { success: true, data: files.map(f => new VaultFileEntity(f)) };
  }

  @Get('files/:id')
  @RequirePermissions(Permission.VAULT_DOWNLOAD)
  async getFileMetadata(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const file = await this.vaultService.getFileMetadata(user.id, id);
    return { success: true, data: new VaultFileEntity(file) };
  }

  @Get('files/:id/download')
  @BypassTransform() // Do not wrap stream with transform interceptor
  @RequirePermissions(Permission.VAULT_DOWNLOAD)
  async downloadFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response
  ) {
    const { filename, mimeType, data } = await this.vaultService.downloadFile(user.id, id);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.send(data);
  }

  @Delete('files/:id')
  @RequirePermissions(Permission.VAULT_DELETE)
  async deleteFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DeleteFileDto
  ) {
    await this.vaultService.deleteFile(user.id, id, dto.version);
    return { success: true, message: 'File successfully deleted.' };
  }

  // ─── Key Rotations ───

  @Post('keys/rotate-dek')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.VAULT_MANAGE)
  async rotateDEK(@CurrentUser() user: AuthenticatedUser) {
    await this.vaultService.rotateDEK(user.id);
    return { success: true, message: 'User Data Encryption Key (DEK) rotated successfully.' };
  }

  @Post('keys/rotate-kek')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.SYSTEM_MANAGE)
  async rotateKEK(@Body() dto: RotateKekDto) {
    await this.vaultService.rotateKEK(dto.oldKekBase64, dto.newKekBase64, dto.newKekVersion);
    return { success: true, message: 'System Master Key (KEK) rotated and all user DEKs rewrapped successfully.' };
  }
}
