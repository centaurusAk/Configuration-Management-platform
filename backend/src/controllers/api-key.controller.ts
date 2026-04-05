import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from '../entities/api-key.entity';

@Controller('api-keys')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApiKeyController {
  constructor(
    private readonly authService: AuthService,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
  ) {}

  @Get()
  @RequirePermission(Permission.MANAGE_API_KEYS)
  async list(@Req() req: any) {
    const user = req.user;
    // List API keys for the user's organization by joining through projects
    const apiKeys = await this.apiKeyRepository
      .createQueryBuilder('ak')
      .innerJoin('projects', 'p', 'p.id = ak.project_id')
      .where('p.organization_id = :orgId', { orgId: user.organization_id })
      .orderBy('ak.created_at', 'DESC')
      .getRawMany();

    // Map raw results to clean objects
    const mapped = apiKeys.map((row: any) => ({
      id: row.ak_id,
      prefix: row.ak_prefix,
      project_id: row.ak_project_id,
      environment_id: row.ak_environment_id,
      created_by: row.ak_created_by,
      created_at: row.ak_created_at,
      expires_at: row.ak_expires_at,
      revoked: row.ak_revoked,
    }));

    return { apiKeys: mapped };
  }

  @Post()
  @RequirePermission(Permission.MANAGE_API_KEYS)
  async create(
    @Body() body: { projectId: string; environmentId: string; expiresAt?: string },
    @Req() req: any,
  ) {
    const user = req.user;
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;
    const key = await this.authService.generateApiKey(
      body.projectId,
      body.environmentId,
      user.id,
      expiresAt,
    );
    return { key };
  }

  @Delete(':id')
  @RequirePermission(Permission.MANAGE_API_KEYS)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Param('id') id: string) {
    await this.authService.revokeApiKey(id);
  }
}
