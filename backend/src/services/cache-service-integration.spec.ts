import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from './config.service';
import { RuleEngineService } from './rule-engine.service';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { ConfigVersionRepository } from '../repositories/config-version.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { RuleRepository } from '../repositories/rule.repository';
import { Context } from '../types/models';
import { AuditLogService } from './audit-log.service';
import { ValidationService } from './validation.service';

/**
 * Integration Tests for Cache Integration in ConfigService and RuleEngine
 * 
 * Tests that caching is properly integrated into both services:
 * - Cache is checked before database queries (Requirement 6.1)
 * - Cache is populated on misses with 60s TTL (Requirement 6.3)
 * - Cache is invalidated on config updates (Requirement 6.4)
 * - Cache is invalidated on rule changes (Requirement 6.5)
 */
describe('Cache Service Integration', () => {
  let configService: ConfigService;
  let ruleEngineService: RuleEngineService;
  let mockCacheService: any;
  let mockConfigKeyRepository: any;
  let mockConfigVersionRepository: any;
  let mockAuditLogRepository: any;
  let mockRuleRepository: any;

  beforeEach(async () => {
    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidate: jest.fn().mockResolvedValue(undefined),
      invalidateConfig: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockConfigKeyRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByKey: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    mockConfigVersionRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByConfigKey: jest.fn(),
    };

    mockAuditLogRepository = {
      create: jest.fn(),
    };

    mockRuleRepository = {
      findEnabledByConfigKey: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockAuditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigService,
        ValidationService,
        RuleEngineService,
        {
          provide: ConfigKeyRepository,
          useValue: mockConfigKeyRepository,
        },
        {
          provide: ConfigVersionRepository,
          useValue: mockConfigVersionRepository,
        },
        {
          provide: AuditLogRepository,
          useValue: mockAuditLogRepository,
        },
        {
          provide: RuleRepository,
          useValue: mockRuleRepository,
        },
        {
          provide: 'CacheService',
          useValue: mockCacheService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
    ruleEngineService = module.get<RuleEngineService>(RuleEngineService);
  });

  describe('ConfigService Caching', () => {
    it('should check cache before querying database (Requirement 6.1)', async () => {
      const configId = 'config-123';
      const cachedConfig = {
        id: configId,
        organization_id: 'org-1',
        project_id: 'proj-1',
        environment_id: 'env-1',
        key_name: 'feature.flag',
        value_type: 'boolean',
        current_value: true,
      };

      mockCacheService.get.mockResolvedValueOnce(cachedConfig);

      const result = await configService.get(configId);

      expect(mockCacheService.get).toHaveBeenCalledWith(`config_key:${configId}`);
      expect(mockConfigKeyRepository.findById).not.toHaveBeenCalled();
      expect(result).toEqual(cachedConfig);
    });

    it('should populate cache on miss with 60s TTL (Requirement 6.3)', async () => {
      const configId = 'config-123';
      const dbConfig = {
        id: configId,
        organization_id: 'org-1',
        project_id: 'proj-1',
        environment_id: 'env-1',
        key_name: 'feature.flag',
        value_type: 'boolean',
        current_value: true,
      };

      mockCacheService.get.mockResolvedValueOnce(null); // Cache miss
      mockConfigKeyRepository.findById.mockResolvedValueOnce(dbConfig);

      const result = await configService.get(configId);

      expect(mockCacheService.get).toHaveBeenCalledWith(`config_key:${configId}`);
      expect(mockConfigKeyRepository.findById).toHaveBeenCalledWith(configId);
      expect(mockCacheService.set).toHaveBeenCalledWith(`config_key:${configId}`, dbConfig, 60);
      expect(result).toEqual(dbConfig);
    });

    it('should invalidate cache on config update (Requirement 6.4)', async () => {
      const configId = 'config-123';
      const config = {
        id: configId,
        organization_id: 'org-1',
        project_id: 'proj-1',
        environment_id: 'env-1',
        key_name: 'feature.flag',
        value_type: 'boolean',
        current_value: false,
      };

      mockCacheService.get.mockResolvedValueOnce(null);
      mockConfigKeyRepository.findById.mockResolvedValueOnce(config);
      mockConfigKeyRepository.update.mockResolvedValueOnce(undefined);
      mockConfigVersionRepository.create.mockResolvedValueOnce({
        id: 'version-1',
        config_key_id: configId,
        value: true,
        created_by: 'user-1',
        created_at: new Date(),
      });
      mockAuditLogRepository.create.mockResolvedValueOnce(undefined);

      await configService.update(configId, { value: true, updatedBy: 'user-1' });

      // Should invalidate config key by ID
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(`config_key:${configId}`);
      
      // Should invalidate config key by name
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(
        `config_key:${config.organization_id}:${config.project_id}:${config.environment_id}:${config.key_name}`
      );
      
      // Should invalidate all context-specific caches
      expect(mockCacheService.invalidateConfig).toHaveBeenCalledWith(
        config.organization_id,
        config.project_id,
        config.environment_id,
        config.key_name,
      );
    });

    it('should invalidate cache on rollback (Requirement 6.4)', async () => {
      const configId = 'config-123';
      const config = {
        id: configId,
        organization_id: 'org-1',
        project_id: 'proj-1',
        environment_id: 'env-1',
        key_name: 'feature.flag',
        value_type: 'boolean',
        current_value: true,
      };
      const targetVersion = {
        id: 'version-1',
        config_key_id: configId,
        value: false,
        created_by: 'user-1',
        created_at: new Date(),
      };

      mockCacheService.get.mockResolvedValueOnce(null);
      mockConfigKeyRepository.findById.mockResolvedValueOnce(config);
      mockConfigVersionRepository.findById.mockResolvedValueOnce(targetVersion);
      mockConfigKeyRepository.update.mockResolvedValueOnce(undefined);
      mockConfigVersionRepository.create.mockResolvedValueOnce({
        id: 'version-2',
        config_key_id: configId,
        value: false,
        created_by: 'user-1',
        created_at: new Date(),
      });
      mockAuditLogRepository.create.mockResolvedValueOnce(undefined);

      await configService.rollback(configId, 'version-1', 'user-1');

      // Should invalidate all caches
      expect(mockCacheService.invalidate).toHaveBeenCalled();
      expect(mockCacheService.invalidateConfig).toHaveBeenCalledWith(
        config.organization_id,
        config.project_id,
        config.environment_id,
        config.key_name,
      );
    });
  });

  describe('RuleEngine Caching', () => {
    const configKey = {
      id: 'config-123',
      organization_id: 'org-1',
      project_id: 'proj-1',
      environment_id: 'env-1',
      key_name: 'feature.flag',
      value_type: 'string',
      current_value: 'default',
    };

    it('should check cache before evaluating rules (Requirement 6.1)', async () => {
      const context: Context = { region: 'us-east-1' };
      const cachedValue = 'cached-value';

      mockConfigKeyRepository.findById.mockResolvedValueOnce(configKey);
      mockCacheService.get.mockResolvedValueOnce(cachedValue);

      const result = await ruleEngineService.evaluate(configKey.id, context);

      expect(mockCacheService.get).toHaveBeenCalled();
      expect(mockRuleRepository.findEnabledByConfigKey).not.toHaveBeenCalled();
      expect(result).toBe(cachedValue);
    });

    it('should populate cache on miss with 60s TTL (Requirement 6.3)', async () => {
      const context: Context = { region: 'us-east-1' };
      const rules = [
        {
          id: 'rule-1',
          config_key_id: configKey.id,
          priority: 100,
          conditions: [{ attribute: 'region', operator: 'equals', value: 'us-east-1' }],
          value: 'rule-value',
          enabled: true,
        },
      ];

      mockConfigKeyRepository.findById.mockResolvedValueOnce(configKey);
      mockCacheService.get.mockResolvedValueOnce(null); // Cache miss
      mockRuleRepository.findEnabledByConfigKey.mockResolvedValueOnce(rules);

      const result = await ruleEngineService.evaluate(configKey.id, context);

      expect(mockCacheService.get).toHaveBeenCalled();
      expect(mockRuleRepository.findEnabledByConfigKey).toHaveBeenCalledWith(configKey.id);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        'rule-value',
        60
      );
      expect(result).toBe('rule-value');
    });

    it('should invalidate cache when rule is created (Requirement 6.5)', async () => {
      const ruleData = {
        configKeyId: configKey.id,
        priority: 100,
        conditions: [{ attribute: 'region', operator: 'equals', value: 'us-east-1' }],
        value: 'new-value',
        enabled: true,
      };

      mockRuleRepository.create.mockResolvedValueOnce({
        id: 'rule-1',
        ...ruleData,
      });
      mockConfigKeyRepository.findById.mockResolvedValueOnce(configKey);
      mockConfigKeyRepository.findById.mockResolvedValueOnce(configKey);

      await ruleEngineService.createRule(
        ruleData.configKeyId,
        ruleData.priority,
        ruleData.conditions,
        ruleData.value,
        'test-user',
        ruleData.enabled,
      );

      expect(mockCacheService.invalidateConfig).toHaveBeenCalledWith(
        configKey.organization_id,
        configKey.project_id,
        configKey.environment_id,
        configKey.key_name,
      );
    });

    it('should invalidate cache when rule is updated (Requirement 6.5)', async () => {
      const ruleId = 'rule-1';
      const rule = {
        id: ruleId,
        config_key_id: configKey.id,
        priority: 100,
        conditions: [],
        value: 'old-value',
        enabled: true,
      };

      mockRuleRepository.findById.mockResolvedValueOnce(rule);
      mockRuleRepository.update.mockResolvedValueOnce({
        ...rule,
        value: 'new-value',
      });
      mockConfigKeyRepository.findById.mockResolvedValueOnce(configKey);
      mockConfigKeyRepository.findById.mockResolvedValueOnce(configKey);

      await ruleEngineService.updateRule(ruleId, { value: 'new-value' }, 'test-user');

      expect(mockCacheService.invalidateConfig).toHaveBeenCalledWith(
        configKey.organization_id,
        configKey.project_id,
        configKey.environment_id,
        configKey.key_name,
      );
    });

    it('should invalidate cache when rule is deleted (Requirement 6.5)', async () => {
      const ruleId = 'rule-1';
      const rule = {
        id: ruleId,
        config_key_id: configKey.id,
        priority: 100,
        conditions: [],
        value: 'value',
        enabled: true,
      };

      mockRuleRepository.findById.mockResolvedValueOnce(rule);
      mockRuleRepository.delete.mockResolvedValueOnce(undefined);
      mockConfigKeyRepository.findById.mockResolvedValueOnce(configKey);
      mockConfigKeyRepository.findById.mockResolvedValueOnce(configKey);

      await ruleEngineService.deleteRule(ruleId, 'test-user');

      expect(mockCacheService.invalidateConfig).toHaveBeenCalledWith(
        configKey.organization_id,
        configKey.project_id,
        configKey.environment_id,
        configKey.key_name,
      );
    });
  });
});
