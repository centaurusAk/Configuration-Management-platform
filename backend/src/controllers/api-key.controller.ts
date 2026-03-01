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

@Controller('api-keys')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApiKeyController {
  constructor(private readonly authService: AuthService) {}

  @Post()
  @RequirePermission(Permission.WRITE_CONFIG)
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
  @RequirePermission(Permission.WRITE_CONFIG)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Param('id') id: string) {
    await this.authService.revokeApiKey(id);
  }
}
