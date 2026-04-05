import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuditLogService } from '../services/audit-log.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @RequirePermission(Permission.READ_AUDIT)
  async getAuditLogs(
    @Req() req: any,
    @Query('userId') userId?: string,
    @Query('actionType') actionType?: 'CREATE' | 'UPDATE' | 'DELETE' | 'ROLLBACK',
    @Query('resourceType') resourceType?: 'CONFIG_KEY' | 'CONFIG_VERSION' | 'RULE' | 'API_KEY' | 'USER',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const user = req.user;
    const filters: any = {
      organizationId: user.organization_id,
    };
    if (userId) filters.userId = userId;
    if (actionType) filters.actionType = actionType;
    if (resourceType) filters.resourceType = resourceType;
    if (startDate && endDate) {
      filters.dateRange = { start: new Date(startDate), end: new Date(endDate) };
    }
    if (limit) filters.limit = parseInt(limit, 10);

    const logs = await this.auditLogService.query(filters);
    return { logs, total: logs.length };
  }
}
