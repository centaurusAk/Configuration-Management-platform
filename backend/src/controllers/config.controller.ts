import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '../services/config.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions';
import { CircuitBreaker } from '../services/circuit-breaker';

// DTOs for request/response
export class CreateConfigDto {
  organizationId: string;
  projectId: string;
  environmentId: string;
  keyName: string;
  valueType: 'boolean' | 'string' | 'number' | 'json';
  defaultValue: any;
  schema?: object;
  createdBy: string;
}

export class UpdateConfigDto {
  value: any;
  updatedBy: string;
}

export class RollbackDto {
  versionId: string;
  rolledBackBy: string;
}

export class BulkUpdateItemDto {
  configId: string;
  value: any;
}

export class BulkUpdateDto {
  updates: BulkUpdateItemDto[];
  updatedBy: string;
}

export class ExportQueryDto {
  organizationId: string;
  projectId: string;
  environmentId: string;
}

export class ImportDto {
  data: any; // ExportData type from ConfigService
  importedBy: string;
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
  async bulkUpdate(@Body() dto: BulkUpdateDto) {
    try {
      return await this.dbCircuitBreaker.execute(() =>
        this.configService.bulkUpdate(dto)
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
  async import(@Body() dto: ImportDto) {
    try {
      return await this.dbCircuitBreaker.execute(() =>
        this.configService.importConfigs(dto.data, dto.importedBy)
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
  async create(@Body() dto: CreateConfigDto) {
    try {
      return await this.dbCircuitBreaker.execute(() => 
        this.configService.create(dto)
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
  async update(@Param('id') id: string, @Body() dto: UpdateConfigDto) {
    try {
      return await this.dbCircuitBreaker.execute(() =>
        this.configService.update(id, dto)
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
  async delete(@Param('id') id: string, @Body('deletedBy') deletedBy: string) {
    try {
      await this.dbCircuitBreaker.execute(() =>
        this.configService.delete(id, deletedBy)
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
  async rollback(@Param('id') id: string, @Body() dto: RollbackDto) {
    try {
      return await this.dbCircuitBreaker.execute(() =>
        this.configService.rollback(id, dto.versionId, dto.rolledBackBy)
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
