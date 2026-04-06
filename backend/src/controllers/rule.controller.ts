import {
  Controller,
  Post,
  Put,
  Delete,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { RuleEngineService } from '../services/rule-engine.service';
import { RuleRepository } from '../repositories/rule.repository';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions';
import { Condition, Context } from '../types/models';

import { IsString, IsNumber, IsBoolean, IsArray, IsOptional, ValidateNested, IsObject, IsDefined } from 'class-validator';
import { Type } from 'class-transformer';

export class ConditionDto {
  @IsString()
  attribute: string;

  @IsString()
  operator: string;

  @IsDefined()
  value: any;
}

export class CreateRuleDto {
  @IsString()
  config_key_id: string;

  @IsNumber()
  priority: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions: ConditionDto[];

  @IsDefined()
  value: any;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  createdBy?: string;
}

export class UpdateRuleDto {
  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions?: ConditionDto[];

  @IsOptional()
  value?: any;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  updatedBy?: string;
}

export class TestRuleDto {
  @IsString()
  config_key_id: string;

  @IsObject()
  context: object;
}

@Controller('rules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RuleController {
  constructor(
    private readonly ruleEngineService: RuleEngineService,
    private readonly ruleRepository: RuleRepository,
  ) {}

  @Post()
  @RequirePermission(Permission.RULE_CREATE)
  async create(@Body() dto: CreateRuleDto, @Req() req: any) {
    return this.ruleEngineService.createRule(
      dto.config_key_id,
      dto.priority,
      dto.conditions,
      dto.value,
      req.user.id || dto.createdBy || 'system',
      dto.enabled ?? true,
    );
  }

  @Put(':id')
  @RequirePermission(Permission.RULE_UPDATE)
  async update(@Param('id') id: string, @Body() dto: UpdateRuleDto, @Req() req: any) {
    return this.ruleEngineService.updateRule(id, dto, req.user.id || dto.updatedBy || 'system');
  }

  @Delete(':id')
  @RequirePermission(Permission.RULE_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @Req() req: any, @Body('deletedBy') deletedBy: string) {
    await this.ruleEngineService.deleteRule(id, req.user.id || deletedBy || 'system');
  }

  @Get('config/:configId')
  @RequirePermission(Permission.RULE_READ)
  async getRulesForConfig(@Param('configId') configId: string) {
    return this.ruleRepository.findByConfigKey(configId);
  }

  @Post('test')
  @RequirePermission(Permission.RULE_READ)
  async testRuleEvaluation(@Body() dto: TestRuleDto) {
    return this.ruleEngineService.evaluateWithTrace(dto.config_key_id, dto.context);
  }
}
