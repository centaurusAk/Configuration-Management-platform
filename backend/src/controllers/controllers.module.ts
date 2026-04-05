import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { RuleController } from './rule.controller';
import { SdkController } from './sdk.controller';
import { HealthController } from './health.controller';
import { AuditLogController } from './audit-log.controller';
import { ApiKeyController } from './api-key.controller';
import { ProjectController } from './project.controller';
import { ConfigModule as ConfigServiceModule } from '../services/config.module';
import { RuleEngineModule } from '../services/rule-engine.module';
import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '../services/cache.module';
import { AuditLogModule } from '../services/audit-log.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigKey } from '../entities/config-key.entity';
import { Rule } from '../entities/rule.entity';
import { ApiKey } from '../entities/api-key.entity';
import { Project } from '../entities/project.entity';
import { Environment } from '../entities/environment.entity';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { RuleRepository } from '../repositories/rule.repository';

@Module({
  imports: [
    ConfigServiceModule,
    RuleEngineModule,
    AuthModule,
    CacheModule,
    AuditLogModule,
    TypeOrmModule.forFeature([ConfigKey, Rule, ApiKey, Project, Environment]),
  ],
  controllers: [
    ConfigController,
    RuleController,
    SdkController,
    HealthController,
    AuditLogController,
    ApiKeyController,
    ProjectController,
  ],
  providers: [ConfigKeyRepository, RuleRepository],
})
export class ControllersModule {}
