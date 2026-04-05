import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from './config.service';
import { ConfigKey } from '../entities/config-key.entity';
import { ConfigVersion } from '../entities/config-version.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { Rule } from '../entities/rule.entity';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { ConfigVersionRepository } from '../repositories/config-version.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { RuleRepository } from '../repositories/rule.repository';
import { ValidationService } from './validation.service';
import { CacheModule } from './cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConfigKey, ConfigVersion, AuditLog, Rule]),
    CacheModule,
  ],
  providers: [
    ConfigService,
    ConfigKeyRepository,
    ConfigVersionRepository,
    AuditLogRepository,
    RuleRepository,
    ValidationService,
  ],
  exports: [ConfigService],
})
export class ConfigModule {}
