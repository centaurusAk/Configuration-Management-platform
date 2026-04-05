import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Organization,
  Project,
  Environment,
  User,
  ConfigKey,
  ConfigVersion,
  Rule,
  ApiKey,
  AuditLog,
} from '../entities';
import {
  OrganizationRepository,
  ProjectRepository,
  EnvironmentRepository,
  UserRepository,
  ConfigKeyRepository,
  ConfigVersionRepository,
  RuleRepository,
  ApiKeyRepository,
  AuditLogRepository,
} from '../repositories';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      Project,
      Environment,
      User,
      ConfigKey,
      ConfigVersion,
      Rule,
      ApiKey,
      AuditLog,
    ]),
  ],
  providers: [
    OrganizationRepository,
    ProjectRepository,
    EnvironmentRepository,
    UserRepository,
    ConfigKeyRepository,
    ConfigVersionRepository,
    RuleRepository,
    ApiKeyRepository,
    AuditLogRepository,
  ],
  exports: [
    OrganizationRepository,
    ProjectRepository,
    EnvironmentRepository,
    UserRepository,
    ConfigKeyRepository,
    ConfigVersionRepository,
    RuleRepository,
    ApiKeyRepository,
    AuditLogRepository,
  ],
})
export class DatabaseModule {}
