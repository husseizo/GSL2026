import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { ApiKeysService } from './api-keys.service';

@ApiTags('api-keys')
@Controller('auth/api-keys')
@UseGuards(PermissionsGuard)
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Post()
  @RequirePermissions('apikeys.manage')
  create(@Body() body: { name: string; role: Role; ownerUserId?: string; isServiceAccount?: boolean; expiresAt?: string }) {
    return this.apiKeys.create({ ...body, expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined });
  }

  @Get()
  @RequirePermissions('apikeys.manage')
  list() {
    return this.apiKeys.list();
  }

  @Delete(':id')
  @RequirePermissions('apikeys.manage')
  revoke(@Param('id') id: string) {
    return this.apiKeys.revoke(id);
  }
}
