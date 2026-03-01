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
} from '@nestjs/common';
import { RuleEngineService } from '../services/rule-engine.service';
import { RuleRepository } from '../repositories/rule.repository';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Permission } from '../auth/permissions';
import { Condition, Context } from '../types/models';

// DTOs for request/response
export class CreateRuleDto {
  config_key_id: string;
  priority: number;
  conditions: Condition[];
  value: any;
  enabled?: boolean;
  createdBy: string;
}

export class UpdateRuleDto {
  priority?: number;
  conditions?: Condition[];
  value?: any;
  enabled?: boolean;
  updatedBy: string;
}

export class TestRuleDto {
  config_key_id: string;
  context: Context;
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
  async create(@Body() dto: CreateRuleDto) {
    return this.ruleEngineService.createRule(
      dto.config_key_id,
      dto.priority,
      dto.conditions,
      dto.value,
      dto.createdBy,
      dto.enabled ?? true,
    );
  }

  @Put(':id')
  @RequirePermission(Permission.RULE_UPDATE)
  async update(@Param('id') id: string, @Body() dto: UpdateRuleDto) {
    return this.ruleEngineService.updateRule(id, dto, dto.updatedBy);
  }

  @Delete(':id')
  @RequirePermission(Permission.RULE_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @Body('deletedBy') deletedBy: string) {
    await this.ruleEngineService.deleteRule(id, deletedBy);
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
