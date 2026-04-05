import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RuleEngineService } from './rule-engine.service';
import { Rule } from '../entities/rule.entity';
import { ConfigKey } from '../entities/config-key.entity';
import { RuleRepository } from '../repositories/rule.repository';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { AuditLogModule } from './audit-log.module';
import { CacheModule } from './cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Rule, ConfigKey]),
    AuditLogModule,
    CacheModule,
  ],
  providers: [
    RuleEngineService,
    RuleRepository,
    ConfigKeyRepository,
  ],
  exports: [RuleEngineService],
})
export class RuleEngineModule {}
