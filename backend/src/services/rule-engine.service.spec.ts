import { Test, TestingModule } from '@nestjs/testing';
import { RuleEngineService } from './rule-engine.service';
import { RuleRepository } from '../repositories/rule.repository';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { Context } from '../types/models';
import { Rule } from '../entities/rule.entity';
import { ConfigKey } from '../entities/config-key.entity';
import { AuditLogService } from './audit-log.service';

describe('RuleEngineService', () => {
  let service: RuleEngineService;
  let ruleRepository: jest.Mocked<RuleRepository>;
  let configKeyRepository: jest.Mocked<ConfigKeyRepository>;
  let mockCacheService: any;

  beforeEach(async () => {
    const mockRuleRepository = {
      findEnabledByConfigKey: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockConfigKeyRepository = {
      findById: jest.fn(),
    };

    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidate: jest.fn().mockResolvedValue(undefined),
      invalidateConfig: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    const mockAuditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RuleEngineService,
        {
          provide: RuleRepository,
          useValue: mockRuleRepository,
        },
        {
          provide: ConfigKeyRepository,
          useValue: mockConfigKeyRepository,
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

    service = module.get<RuleEngineService>(RuleEngineService);
    ruleRepository = module.get(RuleRepository);
    configKeyRepository = module.get(ConfigKeyRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluate', () => {
    const configKeyId = 'config-123';
    const defaultValue = 'default';

    const mockConfigKey: Partial<ConfigKey> = {
      id: configKeyId,
      organization_id: 'org-1',
      project_id: 'proj-1',
      environment_id: 'env-1',
      key_name: 'feature.flag',
      value_type: 'string',
      current_value: defaultValue,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should return value from first matching rule (Requirement 4.3)', async () => {
      const context: Context = { region: 'us-east-1', tier: 'premium' };

      const rules: Partial<Rule>[] = [
        {
          id: 'rule-1',
          config_key_id: configKeyId,
          priority: 100,
          conditions: [{ attribute: 'region', operator: 'equals', value: 'us-east-1' }],
          value: 'rule-1-value',
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'rule-2',
          config_key_id: configKeyId,
          priority: 50,
          conditions: [{ attribute: 'tier', operator: 'equals', value: 'premium' }],
          value: 'rule-2-value',
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      ruleRepository.findEnabledByConfigKey.mockResolvedValue(rules as Rule[]);
      configKeyRepository.findById.mockResolvedValue(mockConfigKey as ConfigKey);

      const result = await service.evaluate(configKeyId, context);

      expect(result).toBe('rule-1-value');
      expect(ruleRepository.findEnabledByConfigKey).toHaveBeenCalledWith(configKeyId);
    });

    it('should evaluate rules in priority order (Requirement 4.2)', async () => {
      const context: Context = { region: 'us-west-2' };

      // Rules returned in priority order (DESC)
      const rules: Partial<Rule>[] = [
        {
          id: 'rule-high',
          config_key_id: configKeyId,
          priority: 200,
          conditions: [{ attribute: 'region', operator: 'equals', value: 'us-west-2' }],
          value: 'high-priority-value',
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'rule-low',
          config_key_id: configKeyId,
          priority: 10,
          conditions: [{ attribute: 'region', operator: 'equals', value: 'us-west-2' }],
          value: 'low-priority-value',
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      ruleRepository.findEnabledByConfigKey.mockResolvedValue(rules as Rule[]);
      configKeyRepository.findById.mockResolvedValue(mockConfigKey as ConfigKey);

      const result = await service.evaluate(configKeyId, context);

      // Should return the high priority rule value
      expect(result).toBe('high-priority-value');
    });

    it('should return default value when no rules match (Requirement 4.4)', async () => {
      const context: Context = { region: 'eu-west-1' };

      const rules: Partial<Rule>[] = [
        {
          id: 'rule-1',
          config_key_id: configKeyId,
          priority: 100,
          conditions: [{ attribute: 'region', operator: 'equals', value: 'us-east-1' }],
          value: 'rule-1-value',
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      ruleRepository.findEnabledByConfigKey.mockResolvedValue(rules as Rule[]);
      configKeyRepository.findById.mockResolvedValue(mockConfigKey as ConfigKey);

      const result = await service.evaluate(configKeyId, context);

      expect(result).toBe(defaultValue);
      expect(configKeyRepository.findById).toHaveBeenCalledWith(configKeyId);
    });

    it('should return default value when no rules exist', async () => {
      const context: Context = { region: 'us-east-1' };

      ruleRepository.findEnabledByConfigKey.mockResolvedValue([]);
      configKeyRepository.findById.mockResolvedValue(mockConfigKey as ConfigKey);

      const result = await service.evaluate(configKeyId, context);

      expect(result).toBe(defaultValue);
    });

    it('should skip disabled rules', async () => {
      const context: Context = { region: 'us-east-1' };

      const rules: Partial<Rule>[] = [
        {
          id: 'rule-disabled',
          config_key_id: configKeyId,
          priority: 100,
          conditions: [{ attribute: 'region', operator: 'equals', value: 'us-east-1' }],
          value: 'disabled-value',
          enabled: false, // This rule is disabled
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      // findEnabledByConfigKey should only return enabled rules
      ruleRepository.findEnabledByConfigKey.mockResolvedValue([]);
      configKeyRepository.findById.mockResolvedValue(mockConfigKey as ConfigKey);

      const result = await service.evaluate(configKeyId, context);

      expect(result).toBe(defaultValue);
    });

    it('should throw error when config key not found', async () => {
      const context: Context = { region: 'us-east-1' };

      ruleRepository.findEnabledByConfigKey.mockResolvedValue([]);
      configKeyRepository.findById.mockResolvedValue(null);

      await expect(service.evaluate(configKeyId, context)).rejects.toThrow(
        `Config key not found: ${configKeyId}`,
      );
    });

    it('should handle multiple conditions with AND logic', async () => {
      const context: Context = { region: 'us-east-1', tier: 'premium' };

      const rules: Partial<Rule>[] = [
        {
          id: 'rule-multi',
          config_key_id: configKeyId,
          priority: 100,
          conditions: [
            { attribute: 'region', operator: 'equals', value: 'us-east-1' },
            { attribute: 'tier', operator: 'equals', value: 'premium' },
          ],
          value: 'multi-condition-value',
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      ruleRepository.findEnabledByConfigKey.mockResolvedValue(rules as Rule[]);
      configKeyRepository.findById.mockResolvedValue(mockConfigKey as ConfigKey);

      const result = await service.evaluate(configKeyId, context);

      expect(result).toBe('multi-condition-value');
    });

    it('should not match when one condition fails in AND logic', async () => {
      const context: Context = { region: 'us-east-1', tier: 'basic' };

      const rules: Partial<Rule>[] = [
        {
          id: 'rule-multi',
          config_key_id: configKeyId,
          priority: 100,
          conditions: [
            { attribute: 'region', operator: 'equals', value: 'us-east-1' },
            { attribute: 'tier', operator: 'equals', value: 'premium' }, // This won't match
          ],
          value: 'multi-condition-value',
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      ruleRepository.findEnabledByConfigKey.mockResolvedValue(rules as Rule[]);
      configKeyRepository.findById.mockResolvedValue(mockConfigKey as ConfigKey);

      const result = await service.evaluate(configKeyId, context);

      expect(result).toBe(defaultValue);
    });

    it('should handle complex rule scenarios', async () => {
      const context: Context = { 
        region: 'us-west-2', 
        tier: 'premium',
        app_version: '2.0.0'
      };

      const rules: Partial<Rule>[] = [
        {
          id: 'rule-1',
          config_key_id: configKeyId,
          priority: 300,
          conditions: [{ attribute: 'region', operator: 'equals', value: 'eu-west-1' }],
          value: 'eu-value',
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'rule-2',
          config_key_id: configKeyId,
          priority: 200,
          conditions: [
            { attribute: 'region', operator: 'equals', value: 'us-west-2' },
            { attribute: 'tier', operator: 'equals', value: 'premium' },
          ],
          value: 'premium-us-west-value',
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'rule-3',
          config_key_id: configKeyId,
          priority: 100,
          conditions: [{ attribute: 'region', operator: 'equals', value: 'us-west-2' }],
          value: 'us-west-value',
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      ruleRepository.findEnabledByConfigKey.mockResolvedValue(rules as Rule[]);
      configKeyRepository.findById.mockResolvedValue(mockConfigKey as ConfigKey);

      const result = await service.evaluate(configKeyId, context);

      // Should match rule-2 (priority 200) since it has higher priority than rule-3
      expect(result).toBe('premium-us-west-value');
    });
  });

  describe('percentage rollout integration', () => {
    const configKeyId = 'config-123';
    const defaultValue = 'default';

    const mockConfigKey: Partial<ConfigKey> = {
      id: configKeyId,
      organization_id: 'org-1',
      project_id: 'proj-1',
      environment_id: 'env-1',
      key_name: 'feature.rollout',
      value_type: 'boolean',
      current_value: defaultValue,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should handle percentage rollout rules (Requirements 3.1, 3.2, 3.3)', async () => {
      const context: Context = { user_id: 'user-123' };

      // Create a percentage rollout rule with special condition
      const rules: Partial<Rule>[] = [
        {
          id: 'rollout-rule',
          config_key_id: configKeyId,
          priority: 100,
          conditions: [
            { attribute: '_percentage_rollout', operator: 'equals', value: 50 }
          ],
          value: true,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      ruleRepository.findEnabledByConfigKey.mockResolvedValue(rules as Rule[]);
      configKeyRepository.findById.mockResolvedValue(mockConfigKey as ConfigKey);

      const result = await service.evaluate(configKeyId, context);

      // Result depends on hash of user_id + config_key
      // We just verify it returns a boolean (either rollout value or default)
      expect(typeof result).toBe('boolean');
    });

    it('should return default when user_id is missing for percentage rollout (Requirement 3.3)', async () => {
      const context: Context = { region: 'us-east-1' }; // No user_id

      const rules: Partial<Rule>[] = [
        {
          id: 'rollout-rule',
          config_key_id: configKeyId,
          priority: 100,
          conditions: [
            { attribute: '_percentage_rollout', operator: 'equals', value: 50 }
          ],
          value: true,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      ruleRepository.findEnabledByConfigKey.mockResolvedValue(rules as Rule[]);
      configKeyRepository.findById.mockResolvedValue(mockConfigKey as ConfigKey);

      const result = await service.evaluate(configKeyId, context);

      // Should return default value when user_id is missing
      expect(result).toBe(defaultValue);
    });

    it('should handle 100% rollout (all users)', async () => {
      const context: Context = { user_id: 'any-user' };

      const rules: Partial<Rule>[] = [
        {
          id: 'rollout-rule',
          config_key_id: configKeyId,
          priority: 100,
          conditions: [
            { attribute: '_percentage_rollout', operator: 'equals', value: 100 }
          ],
          value: true,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      ruleRepository.findEnabledByConfigKey.mockResolvedValue(rules as Rule[]);
      configKeyRepository.findById.mockResolvedValue(mockConfigKey as ConfigKey);

      const result = await service.evaluate(configKeyId, context);

      // 100% rollout should always return the rollout value
      expect(result).toBe(true);
    });

    it('should handle 0% rollout (no users)', async () => {
      const context: Context = { user_id: 'any-user' };

      const rules: Partial<Rule>[] = [
        {
          id: 'rollout-rule',
          config_key_id: configKeyId,
          priority: 100,
          conditions: [
            { attribute: '_percentage_rollout', operator: 'equals', value: 0 }
          ],
          value: true,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      ruleRepository.findEnabledByConfigKey.mockResolvedValue(rules as Rule[]);
      configKeyRepository.findById.mockResolvedValue(mockConfigKey as ConfigKey);

      const result = await service.evaluate(configKeyId, context);

      // 0% rollout should always return the default value
      expect(result).toBe(defaultValue);
    });

    it('should respect priority order with mixed rule types', async () => {
      const context: Context = { user_id: 'user-123', region: 'us-east-1' };

      const rules: Partial<Rule>[] = [
        {
          id: 'regular-rule',
          config_key_id: configKeyId,
          priority: 200,
          conditions: [
            { attribute: 'region', operator: 'equals', value: 'us-east-1' }
          ],
          value: 'region-value',
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'rollout-rule',
          config_key_id: configKeyId,
          priority: 100,
          conditions: [
            { attribute: '_percentage_rollout', operator: 'equals', value: 100 }
          ],
          value: 'rollout-value',
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      ruleRepository.findEnabledByConfigKey.mockResolvedValue(rules as Rule[]);
      configKeyRepository.findById.mockResolvedValue(mockConfigKey as ConfigKey);

      const result = await service.evaluate(configKeyId, context);

      // Higher priority regular rule should match first
      expect(result).toBe('region-value');
    });

    it('should fall through to next rule when user not in rollout', async () => {
      const context: Context = { user_id: 'user-123', region: 'us-east-1' };

      const rules: Partial<Rule>[] = [
        {
          id: 'rollout-rule',
          config_key_id: configKeyId,
          priority: 200,
          conditions: [
            { attribute: '_percentage_rollout', operator: 'equals', value: 0 }
          ],
          value: 'rollout-value',
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'regular-rule',
          config_key_id: configKeyId,
          priority: 100,
          conditions: [
            { attribute: 'region', operator: 'equals', value: 'us-east-1' }
          ],
          value: 'region-value',
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      ruleRepository.findEnabledByConfigKey.mockResolvedValue(rules as Rule[]);
      configKeyRepository.findById.mockResolvedValue(mockConfigKey as ConfigKey);

      const result = await service.evaluate(configKeyId, context);

      // 0% rollout should not match, fall through to region rule
      expect(result).toBe('region-value');
    });

    it('should use config key name for rollout hash', async () => {
      const context: Context = { user_id: 'user-123' };

      const rules: Partial<Rule>[] = [
        {
          id: 'rollout-rule',
          config_key_id: configKeyId,
          priority: 100,
          conditions: [
            { attribute: '_percentage_rollout', operator: 'equals', value: 50 }
          ],
          value: 'rollout-value',
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      ruleRepository.findEnabledByConfigKey.mockResolvedValue(rules as Rule[]);
      configKeyRepository.findById.mockResolvedValue(mockConfigKey as ConfigKey);

      await service.evaluate(configKeyId, context);

      // Verify config key was fetched (needed for key_name in hash)
      expect(configKeyRepository.findById).toHaveBeenCalledWith(configKeyId);
    });
  });
});
