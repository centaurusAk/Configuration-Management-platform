import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { RuleController } from './rule.controller';
import { SdkController } from './sdk.controller';
import { HealthController } from './health.controller';
import { AuditLogController } from './audit-log.controller';
import { ApiKeyController } from './api-key.controller';
import { ConfigModule as ConfigServiceModule } from '../services/config.module';
import { RuleEngineModule } from '../services/rule-engine.module';
import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '../services/cache.module';
import { AuditLogModule } from '../services/audit-log.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigKey } from '../entities/config-key.entity';
import { Rule } from '../entities/rule.entity';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { RuleRepository } from '../repositories/rule.repository';

@Module({
  imports: [
    ConfigServiceModule,
    RuleEngineModule,
    AuthModule,
    CacheModule,
    AuditLogModule,
    TypeOrmModule.forFeature([ConfigKey, Rule]),
  ],
  controllers: [ConfigController, RuleController, SdkController, HealthController, AuditLogController, ApiKeyController],
  providers: [ConfigKeyRepository, RuleRepository],
})
export class ControllersModule {}
