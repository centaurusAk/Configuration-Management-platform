import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { IsString, IsOptional, IsArray, ValidateNested, IsIn, IsDefined, IsObject, Allow } from 'class-validator';
import { Type } from 'class-transformer';
import { ConfigService } from '../services/config.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions';
import { CircuitBreaker } from '../services/circuit-breaker';

// DTOs for request/response — all properties decorated so ValidationPipe doesn't strip them

export class CreateConfigDto {
  @IsString()
  projectId: string;

  @IsString()
  environmentId: string;

  @IsString()
  keyName: string;

  @IsIn(['boolean', 'string', 'number', 'json'])
  valueType: 'boolean' | 'string' | 'number' | 'json';

  @IsDefined()
  @Allow()
  defaultValue: any;

  @IsOptional()
  @IsObject()
  schema?: object;
}

export class UpdateConfigDto {
  @IsDefined()
  @Allow()
  value: any;
}

export class RollbackDto {
  @IsString()
  versionId: string;
}

export class BulkUpdateItemDto {
  @IsString()
  configId: string;

  @IsDefined()
  @Allow()
  value: any;
}

export class BulkUpdateDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateItemDto)
  updates: BulkUpdateItemDto[];
}

export class ExportQueryDto {
  @IsString()
  organizationId: string;

  @IsString()
  projectId: string;

  @IsString()
  environmentId: string;
}

export class ImportDto {
  @IsDefined()
  @IsObject()
  data: any; // ExportData type from ConfigService

  @IsOptional()
  @IsString()
  importedBy?: string;
}

@Controller('configs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ConfigController {
  private readonly logger = new Logger(ConfigController.name);
  private readonly dbCircuitBreaker: CircuitBreaker;

  constructor(private readonly configService: ConfigService) {
    // Initialize circuit breaker for database operations
    this.dbCircuitBreaker = new CircuitBreaker({
      threshold: 5,
      timeout: 60000,
      successThreshold: 2,
    });
  }

  // Static routes must be defined before parameterized routes
  @Get()
  @RequirePermission(Permission.READ_CONFIG)
  async list(@Req() req: any) {
    const user = req.user;
    return this.configService.listByOrganization(user.organization_id);
  }

  @Get('export')
  @RequirePermission(Permission.READ_CONFIG)
  async export(@Query() query: ExportQueryDto) {
    return this.configService.exportConfigs(
      query.organizationId,
      query.projectId,
      query.environmentId,
    );
  }

  @Post('bulk')
  @RequirePermission(Permission.WRITE_CONFIG)
  async bulkUpdate(@Body() dto: BulkUpdateDto, @Req() req: any) {
    try {
      return await this.dbCircuitBreaker.execute(() =>
        this.configService.bulkUpdate({
          updates: dto.updates,
          updatedBy: req.user.id,
        })
      );
    } catch (error) {
      if (error.message === 'Circuit breaker is OPEN') {
        this.logger.error('Database unavailable for write operation');
        throw new ServiceUnavailableException('Database temporarily unavailable');
      }
      throw error;
    }
  }

  @Post('import')
  @RequirePermission(Permission.WRITE_CONFIG)
  async import(@Body() dto: ImportDto, @Req() req: any) {
    try {
      return await this.dbCircuitBreaker.execute(() =>
        this.configService.importConfigs(dto.data, req.user.id)
      );
    } catch (error) {
      if (error.message === 'Circuit breaker is OPEN') {
        this.logger.error('Database unavailable for write operation');
        throw new ServiceUnavailableException('Database temporarily unavailable');
      }
      throw error;
    }
  }

  @Post()
  @RequirePermission(Permission.WRITE_CONFIG)
  async create(@Body() dto: CreateConfigDto, @Req() req: any) {
    try {
      return await this.dbCircuitBreaker.execute(() =>
        this.configService.create({
          organizationId: req.user.organization_id,
          projectId: dto.projectId,
          environmentId: dto.environmentId,
          keyName: dto.keyName,
          valueType: dto.valueType,
          defaultValue: dto.defaultValue,
          schema: dto.schema,
          createdBy: req.user.id,
        })
      );
    } catch (error) {
      if (error.message === 'Circuit breaker is OPEN') {
        this.logger.error('Database unavailable for write operation');
        throw new ServiceUnavailableException('Database temporarily unavailable');
      }
      throw error;
    }
  }

  @Get(':id')
  @RequirePermission(Permission.READ_CONFIG)
  async get(@Param('id') id: string) {
    return this.configService.get(id);
  }

  @Put(':id')
  @RequirePermission(Permission.WRITE_CONFIG)
  async update(@Param('id') id: string, @Body() dto: UpdateConfigDto, @Req() req: any) {
    try {
      return await this.dbCircuitBreaker.execute(() =>
        this.configService.update(id, {
          value: dto.value,
          updatedBy: req.user.id,
        })
      );
    } catch (error) {
      if (error.message === 'Circuit breaker is OPEN') {
        this.logger.error('Database unavailable for write operation');
        throw new ServiceUnavailableException('Database temporarily unavailable');
      }
      throw error;
    }
  }

  @Delete(':id')
  @RequirePermission(Permission.DELETE_CONFIG)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @Req() req: any) {
    try {
      await this.dbCircuitBreaker.execute(() =>
        this.configService.delete(id, req.user.id)
      );
    } catch (error) {
      if (error.message === 'Circuit breaker is OPEN') {
        this.logger.error('Database unavailable for write operation');
        throw new ServiceUnavailableException('Database temporarily unavailable');
      }
      throw error;
    }
  }

  @Get(':id/versions')
  @RequirePermission(Permission.READ_CONFIG)
  async getVersionHistory(@Param('id') id: string) {
    return this.configService.getVersionHistory(id);
  }

  @Post(':id/rollback')
  @RequirePermission(Permission.WRITE_CONFIG)
  async rollback(@Param('id') id: string, @Body() dto: RollbackDto, @Req() req: any) {
    try {
      return await this.dbCircuitBreaker.execute(() =>
        this.configService.rollback(id, dto.versionId, req.user.id)
      );
    } catch (error) {
      if (error.message === 'Circuit breaker is OPEN') {
        this.logger.error('Database unavailable for write operation');
        throw new ServiceUnavailableException('Database temporarily unavailable');
      }
      throw error;
    }
  }
}
