import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { BackupService } from './backup.service';

@ApiTags('backup')
@Controller('backup')
@UseGuards(PermissionsGuard)
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  @Post('full')
  @RequirePermissions('backup.manage')
  createFull() {
    return this.backup.createFullBackup();
  }

  @Get()
  @RequirePermissions('backup.manage')
  list() {
    return this.backup.listBackups();
  }

  @Post('validate-restore')
  @RequirePermissions('backup.manage')
  validateRestore(@Body() body: { backupRunId: string; scratchDatabaseUrl: string; tables: string[] }) {
    return this.backup.validateRestore(body.backupRunId, body.scratchDatabaseUrl, body.tables);
  }

  @Get('restore-validations')
  @RequirePermissions('backup.manage')
  listValidations() {
    return this.backup.listRestoreValidations();
  }
}
