import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { ConfigVersionRepository } from '../repositories/config-version.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { RuleRepository } from '../repositories/rule.repository';
import { ConfigKey } from '../entities/config-key.entity';
import { ConfigVersion } from '../entities/config-version.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { Rule } from '../entities/rule.entity';
import { CacheService } from './cache.service';
import { ValidationService } from './validation.service';

export interface CreateConfigDto {
  organizationId: string;
  projectId: string;
  environmentId: string;
  keyName: string;
  valueType: 'boolean' | 'string' | 'number' | 'json';
  defaultValue: any;
  schema?: object;
  createdBy: string;
}

export interface UpdateConfigDto {
  value: any;
  updatedBy: string;
}

export interface UpdateSchemaDto {
  schema: object;
  updatedBy: string;
}

export interface BulkUpdateItemDto {
  configId: string;
  value: any;
}

export interface BulkUpdateDto {
  updates: BulkUpdateItemDto[];
  updatedBy: string;
}

export interface ExportData {
  version: string;
  exportedAt: Date;
  organizationId: string;
  projectId: string;
  environmentId: string;
  configs: Array<{
    keyName: string;
    valueType: 'boolean' | 'string' | 'number' | 'json';
    currentValue: any;
    schema?: object;
    rules: Array<{
      priority: number;
      conditions: any[];
      value: any;
      enabled: boolean;
    }>;
  }>;
}

/**
 * ConfigService - Manages configuration keys and their version history
 * 
 * Requirements:
 * - 1.1: Create and manage configuration keys
 * - 1.2: Initialize with default value and create first version
 * - 1.4: Create new version on every update
 * - 1.5: Return most recent version
 * - 1.6: Soft delete only
 * - 2.1: Record changes with timestamp, user, and previous value
 * - 2.2: Return version history in reverse chronological order
 * - 2.3: Rollback creates new version with historical value
 * - 6.1: Check cache before database queries
 * - 6.3: Populate cache on misses with 60s TTL
 * - 6.4: Invalidate cache on config updates
 */
@Injectable()
export class ConfigService {
  constructor(
    private readonly configKeyRepository: ConfigKeyRepository,
    private readonly configVersionRepository: ConfigVersionRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly ruleRepository: RuleRepository,
    @Inject('CacheService') private readonly cacheService: CacheService,
    private readonly validationService: ValidationService,
  ) {}

  /**
   * List all configuration keys for an organization
   */
  async listByOrganization(organizationId: string): Promise<ConfigKey[]> {
    return this.configKeyRepository.findAll(organizationId);
  }

  /**
   * Create a new configuration key
   * Requirement 1.1: Store config in database with organization, project, and environment
   * Requirement 1.2: Initialize with default value and create first version
   * Requirement 15.5: Validate current value when adding schema
   */
  async create(dto: CreateConfigDto): Promise<ConfigKey> {
    // Validate value type matches the actual value
    this.validateValueType(dto.defaultValue, dto.valueType);

    // Validate against schema if provided (Requirement 15.5)
    if (dto.schema) {
      this.validateAgainstSchema(dto.defaultValue, dto.schema);
    }

    // Create the config key
    const configKey = await this.configKeyRepository.create(
      dto.organizationId,
      dto.projectId,
      dto.environmentId,
      dto.keyName,
      dto.valueType,
      dto.defaultValue,
      dto.schema,
    );

    // Create the initial version (Requirement 1.2)
    await this.configVersionRepository.create(
      configKey.id,
      dto.defaultValue,
      dto.createdBy,
    );

    // Audit log the creation (Requirement 8.1)
    await this.auditLogRepository.create(
      dto.createdBy,
      dto.organizationId,
      'CREATE',
      'CONFIG_KEY',
      configKey.id,
      null,
      dto.defaultValue,
      {
        key_name: dto.keyName,
        value_type: dto.valueType,
      },
    );

    return configKey;
  }

  /**
   * Get a configuration key by ID
   * Requirement 1.5: Return the most recent version
   * Requirement 6.1: Check cache before database queries
   * Requirement 6.3: Populate cache on misses with 60s TTL
   */
  async get(id: string): Promise<ConfigKey> {
    // Try cache first (Requirement 6.1)
    const cacheKey = `config_key:${id}`;
    const cached = await this.cacheService.get(cacheKey);
    
    if (cached !== null) {
      return cached;
    }

    // Cache miss - query database
    const configKey = await this.configKeyRepository.findById(id);
    if (!configKey) {
      throw new NotFoundException(`Configuration key with ID ${id} not found`);
    }

    // Populate cache with 60s TTL (Requirement 6.3)
    await this.cacheService.set(cacheKey, configKey, 60);

    return configKey;
  }

  /**
   * Get a configuration key by name
   * Requirement 6.1: Check cache before database queries
   * Requirement 6.3: Populate cache on misses with 60s TTL
   */
  async getByKey(
    organizationId: string,
    projectId: string,
    environmentId: string,
    keyName: string,
  ): Promise<ConfigKey> {
    // Try cache first (Requirement 6.1)
    const cacheKey = `config_key:${organizationId}:${projectId}:${environmentId}:${keyName}`;
    const cached = await this.cacheService.get(cacheKey);
    
    if (cached !== null) {
      return cached;
    }

    // Cache miss - query database
    const configKey = await this.configKeyRepository.findByKey(
      organizationId,
      projectId,
      environmentId,
      keyName,
    );
    if (!configKey) {
      throw new NotFoundException(
        `Configuration key '${keyName}' not found in the specified environment`,
      );
    }

    // Populate cache with 60s TTL (Requirement 6.3)
    await this.cacheService.set(cacheKey, configKey, 60);

    return configKey;
  }

  /**
   * Update a configuration value
   * Requirement 1.4: Create new version on every update
   * Requirement 2.1: Record change with timestamp, user, and previous value
   * Requirement 6.4: Invalidate cache on config updates
   */
  async update(id: string, dto: UpdateConfigDto): Promise<ConfigVersion> {
    const configKey = await this.get(id);

    // Validate value type matches
    this.validateValueType(dto.value, configKey.value_type);

    // Validate against schema if present (Requirement 15.2)
    if (configKey.schema) {
      this.validateAgainstSchema(dto.value, configKey.schema);
    }

    const oldValue = configKey.current_value;

    // Update the current value
    await this.configKeyRepository.update(id, {
      current_value: dto.value,
    });

    // Create new version (Requirement 1.4)
    const newVersion = await this.configVersionRepository.create(
      id,
      dto.value,
      dto.updatedBy,
    );

    // Audit log the update (Requirement 8.1)
    await this.auditLogRepository.create(
      dto.updatedBy,
      configKey.organization_id,
      'UPDATE',
      'CONFIG_KEY',
      id,
      oldValue,
      dto.value,
      {
        version_id: newVersion.id,
        key_name: configKey.key_name,
      },
    );

    // Invalidate cache (Requirement 6.4)
    await this.invalidateCacheForConfig(configKey);

    return newVersion;
  }

  /**
   * Soft delete a configuration key
   * Requirement 1.6: Prevent deletion of ConfigKeys that have historical versions (soft delete only)
   */
  async delete(id: string, deletedBy: string): Promise<void> {
    const configKey = await this.get(id);

    // Perform soft delete
    await this.configKeyRepository.softDelete(id);

    // Audit log the deletion (Requirement 8.1)
    await this.auditLogRepository.create(
      deletedBy,
      configKey.organization_id,
      'DELETE',
      'CONFIG_KEY',
      id,
      configKey.current_value,
      null,
      {
        key_name: configKey.key_name,
        soft_delete: true,
      },
    );
  }

  /**
   * Update or add a schema to a configuration key
   * Requirement 15.5: Validate current value when adding schema
   */
  async updateSchema(id: string, dto: UpdateSchemaDto): Promise<ConfigKey> {
    const configKey = await this.get(id);

    // Requirement 15.5: Validate current value against new schema
    this.validateAgainstSchema(configKey.current_value, dto.schema);

    // Update the schema
    await this.configKeyRepository.update(id, {
      schema: dto.schema,
    });

    // Audit log the schema update
    await this.auditLogRepository.create(
      dto.updatedBy,
      configKey.organization_id,
      'UPDATE',
      'CONFIG_KEY',
      id,
      configKey.schema,
      dto.schema,
      {
        key_name: configKey.key_name,
        schema_update: true,
      },
    );

    // Invalidate cache
    await this.invalidateCacheForConfig(configKey);

    // Return updated config key
    return this.get(id);
  }

  /**
   * Get version history for a configuration key
   * Requirement 2.2: Return all versions in reverse chronological order
   */
  async getVersionHistory(id: string): Promise<ConfigVersion[]> {
    // Verify config exists
    await this.get(id);

    // Get all versions in reverse chronological order
    return this.configVersionRepository.findByConfigKey(id);
  }

  /**
   * Rollback to a previous version
   * Requirement 2.3: Create new version with historical value
   * Requirement 2.4: Record rollback action in audit log
   * Requirement 6.4: Invalidate cache on config updates
   */
  async rollback(
    configId: string,
    versionId: string,
    rolledBackBy: string,
  ): Promise<ConfigVersion> {
    const configKey = await this.get(configId);

    // Get the target version
    const targetVersion = await this.configVersionRepository.findById(versionId);
    if (!targetVersion) {
      throw new NotFoundException(`Version with ID ${versionId} not found`);
    }

    // Verify the version belongs to this config
    if (targetVersion.config_key_id !== configId) {
      throw new BadRequestException(
        'Version does not belong to the specified configuration',
      );
    }

    const oldValue = configKey.current_value;
    const newValue = targetVersion.value;

    // Update current value
    await this.configKeyRepository.update(configId, {
      current_value: newValue,
    });

    // Create new version with the historical value (Requirement 2.3)
    const newVersion = await this.configVersionRepository.create(
      configId,
      newValue,
      rolledBackBy,
    );

    // Audit log the rollback (Requirement 2.4)
    await this.auditLogRepository.create(
      rolledBackBy,
      configKey.organization_id,
      'ROLLBACK',
      'CONFIG_KEY',
      configId,
      oldValue,
      newValue,
      {
        version_id: newVersion.id,
        source_version_id: versionId,
        key_name: configKey.key_name,
      },
    );

    // Invalidate cache (Requirement 6.4)
    await this.invalidateCacheForConfig(configKey);

    return newVersion;
  }

  /**
   * Bulk update multiple configuration values atomically
   * Requirement 16.1: Provide bulk update endpoint
   * Requirement 16.2: Validate all updates before applying any
   * Requirement 16.3: Reject entire operation if any update fails validation
   * Requirement 16.4: Create versions with synchronized timestamps
   * Requirement 16.5: Record single audit log entry
   * Requirement 16.6: Invalidate all affected cache entries
   */
  async bulkUpdate(dto: BulkUpdateDto): Promise<ConfigVersion[]> {
    if (!dto.updates || dto.updates.length === 0) {
      throw new BadRequestException('No updates provided');
    }

    // Step 1: Fetch all config keys and validate (Requirement 16.2)
    const configKeys: ConfigKey[] = [];
    const validationErrors: string[] = [];

    for (const update of dto.updates) {
      try {
        const configKey = await this.get(update.configId);
        
        // Validate value type matches
        this.validateValueType(update.value, configKey.value_type);

        // Validate against schema if present
        if (configKey.schema) {
          this.validateAgainstSchema(update.value, configKey.schema);
        }

        configKeys.push(configKey);
      } catch (error) {
        validationErrors.push(`Config ${update.configId}: ${error.message}`);
      }
    }

    // Requirement 16.3: If any validation fails, reject entire operation
    if (validationErrors.length > 0) {
      throw new BadRequestException({
        message: 'Bulk update validation failed',
        errors: validationErrors,
      });
    }

    // Step 2: Execute all updates in a transaction for atomicity
    const newVersions: ConfigVersion[] = [];
    const timestamp = new Date();

    try {
      // Use transaction to ensure atomicity (Requirement 16.2, 16.3)
      await this.configKeyRepository['repository'].manager.transaction(async (manager) => {
        for (let i = 0; i < dto.updates.length; i++) {
          const update = dto.updates[i];
          const configKey = configKeys[i];
          
          // Update current value
          await manager.update(ConfigKey, configKey.id, {
            current_value: update.value,
            updated_at: timestamp,
          });

          // Create new version with synchronized timestamp (Requirement 16.4)
          const version = manager.create(ConfigVersion, {
            config_key_id: configKey.id,
            value: update.value,
            created_by: dto.updatedBy,
            created_at: timestamp,
          });
          const savedVersion = await manager.save(ConfigVersion, version);
          newVersions.push(savedVersion);
        }

        // Create single audit log entry (Requirement 16.5)
        const configIds = configKeys.map(ck => ck.id);
        const oldValues = configKeys.map(ck => ({ id: ck.id, value: ck.current_value }));
        const newValues = dto.updates.map(u => ({ id: u.configId, value: u.value }));

        const auditLog = manager.create(AuditLog, {
          user_id: dto.updatedBy,
          organization_id: configKeys[0].organization_id,
          action_type: 'UPDATE',
          resource_type: 'CONFIG_KEY',
          resource_id: configKeys[0].id,
          old_value: oldValues,
          new_value: newValues,
          metadata: {
            bulk_update: true,
            config_ids: configIds,
            count: configIds.length,
          },
          timestamp: timestamp,
        });
        await manager.save(AuditLog, auditLog);
      });

      // Step 3: Invalidate cache for all affected configs (Requirement 16.6)
      for (const configKey of configKeys) {
        await this.invalidateCacheForConfig(configKey);
      }

      return newVersions;
    } catch (error) {
      // Transaction will automatically rollback on error
      throw new BadRequestException(`Bulk update failed: ${error.message}`);
    }
  }

  /**
   * Validate that a value matches the expected type
   */
  private validateValueType(value: any, expectedType: string): void {
    const actualType = this.getValueType(value);
    if (actualType !== expectedType) {
      throw new BadRequestException(
        `Value type mismatch: expected ${expectedType}, got ${actualType}`,
      );
    }
  }

  /**
   * Determine the type of a value
   */
  private getValueType(value: any): string {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'object' && value !== null) return 'json';
    throw new BadRequestException(`Unsupported value type: ${typeof value}`);
  }

  /**
   * Validate a value against a JSON schema
   * Requirement 15.2: Validate values against schema on update
   * Requirement 15.3: Return 400 with detailed errors on validation failure
   */
  private validateAgainstSchema(value: any, schema: object): void {
    this.validationService.validateAgainstSchema(value, schema);
  }

  /**
   * Invalidate all cache entries for a config key
   * Requirement 6.4: Invalidate cache on config updates
   * 
   * Invalidates:
   * - Config key by ID cache
   * - Config key by name cache
   * - All context-specific config value caches
   */
  private async invalidateCacheForConfig(configKey: ConfigKey): Promise<void> {
    // Invalidate config key by ID
    await this.cacheService.invalidate(`config_key:${configKey.id}`);

    // Invalidate config key by name
    await this.cacheService.invalidate(
      `config_key:${configKey.organization_id}:${configKey.project_id}:${configKey.environment_id}:${configKey.key_name}`
    );

    // Invalidate all context-specific config values (Requirement 6.4)
    await this.cacheService.invalidateConfig(
      configKey.organization_id,
      configKey.project_id,
      configKey.environment_id,
      configKey.key_name,
    );
  }

  /**
   * Export all configurations for a project and environment
   * Requirement 17.1: Export JSON with all configs, values, and rules
   * Requirement 17.5: Support filtering by project and environment
   */
  async exportConfigs(
    organizationId: string,
    projectId: string,
    environmentId: string,
  ): Promise<ExportData> {
    // Fetch all configs for the specified environment
    const configKeys = await this.configKeyRepository.findByEnvironment(
      organizationId,
      projectId,
      environmentId,
    );

    // Build export data with configs and their rules
    const configs = await Promise.all(
      configKeys.map(async (configKey) => {
        // Fetch all rules for this config
        const rules = await this.ruleRepository.findByConfigKey(configKey.id);

        return {
          keyName: configKey.key_name,
          valueType: configKey.value_type,
          currentValue: configKey.current_value,
          schema: configKey.schema,
          rules: rules.map((rule) => ({
            priority: rule.priority,
            conditions: rule.conditions,
            value: rule.value,
            enabled: rule.enabled,
          })),
        };
      }),
    );

    return {
      version: '1.0',
      exportedAt: new Date(),
      organizationId,
      projectId,
      environmentId,
      configs,
    };
  }

  /**
   * Import configurations from JSON
   *
   * Requirement 17.2: Parse JSON and create or update configs
   * Requirement 17.3: Validate all configs before applying
   * Requirement 17.4: Create new versions for existing configs
   * Requirement 17.6: Preserve rule priorities
   */
  async importConfigs(
    data: ExportData,
    importedBy: string,
  ): Promise<{ created: number; updated: number }> {
    const { organizationId, projectId, environmentId, configs } = data;

    // Requirement 17.3: Validate all configs before applying
    for (const config of configs) {
      // Validate value type
      this.validateValueType(config.currentValue, config.valueType);

      // Validate against schema if present
      if (config.schema) {
        this.validateAgainstSchema(config.currentValue, config.schema);
      }

      // Validate all rule values
      for (const rule of config.rules) {
        this.validateValueType(rule.value, config.valueType);
        if (config.schema) {
          this.validateAgainstSchema(rule.value, config.schema);
        }
      }
    }

    // Use transaction for atomicity
    const manager = this.configKeyRepository['repository'].manager;

    let created = 0;
    let updated = 0;

    try {
      await manager.transaction(async (transactionalManager) => {
        for (const config of configs) {
          // Check if config already exists
          const existing = await this.configKeyRepository.findByKey(
            organizationId,
            projectId,
            environmentId,
            config.keyName,
          );

          let configKey: ConfigKey;

          if (existing) {
            // Requirement 17.4: Create new version for existing config
            const oldValue = existing.current_value;
            
            // Update current value and schema
            await transactionalManager.update(ConfigKey, existing.id, {
              current_value: config.currentValue,
              schema: config.schema || existing.schema,
            });

            configKey = { ...existing, current_value: config.currentValue, schema: config.schema || existing.schema };

            // Create new version
            const version = transactionalManager.create(ConfigVersion, {
              config_key_id: existing.id,
              value: config.currentValue,
              created_by: importedBy,
            });
            await transactionalManager.save(ConfigVersion, version);

            // Log audit entry
            const auditLog = transactionalManager.create(AuditLog, {
              user_id: importedBy,
              organization_id: organizationId,
              action_type: 'UPDATE',
              resource_type: 'CONFIG_KEY',
              resource_id: existing.id,
              old_value: oldValue,
              new_value: config.currentValue,
              metadata: { source: 'import' },
            });
            await transactionalManager.save(AuditLog, auditLog);

            updated++;
          } else {
            // Requirement 17.2: Create new config
            const newConfig = transactionalManager.create(ConfigKey, {
              organization_id: organizationId,
              project_id: projectId,
              environment_id: environmentId,
              key_name: config.keyName,
              value_type: config.valueType,
              current_value: config.currentValue,
              schema: config.schema,
            });
            const savedConfig = await transactionalManager.save(ConfigKey, newConfig);
            configKey = savedConfig;

            // Create initial version
            const version = transactionalManager.create(ConfigVersion, {
              config_key_id: savedConfig.id,
              value: config.currentValue,
              created_by: importedBy,
            });
            await transactionalManager.save(ConfigVersion, version);

            // Log audit entry
            const auditLog = transactionalManager.create(AuditLog, {
              user_id: importedBy,
              organization_id: organizationId,
              action_type: 'CREATE',
              resource_type: 'CONFIG_KEY',
              resource_id: savedConfig.id,
              old_value: undefined,
              new_value: config.currentValue,
              metadata: { source: 'import' },
            });
            await transactionalManager.save(AuditLog, auditLog);

            created++;
          }

          // Import rules (Requirement 17.6: Preserve priorities)
          // Delete existing rules for this config
          const existingRules = await this.ruleRepository.findByConfigKey(configKey.id);
          for (const rule of existingRules) {
            await transactionalManager.remove(rule);
          }

          // Create new rules with preserved priorities
          for (const ruleData of config.rules) {
            const rule = transactionalManager.create(Rule, {
              config_key_id: configKey.id,
              priority: ruleData.priority,
              conditions: ruleData.conditions,
              value: ruleData.value,
              enabled: ruleData.enabled,
            });
            await transactionalManager.save(Rule, rule);
          }

          // Invalidate cache for this config
          await this.invalidateCacheForConfig(configKey);
        }
      });
    } catch (error) {
      throw new BadRequestException(`Import failed: ${error.message}`);
    }

    return { created, updated };
  }

}

