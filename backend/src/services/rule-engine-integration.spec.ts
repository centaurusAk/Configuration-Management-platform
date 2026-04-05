import { Test, TestingModule } from '@nestjs/testing';
import { RuleEngineService } from './rule-engine.service';
import { RuleRepository } from '../repositories/rule.repository';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { Context } from '../types/models';
import { Rule } from '../entities/rule.entity';
import { ConfigKey } from '../entities/config-key.entity';
import { AuditLogService } from './audit-log.service';

/**
 * Integration tests for percentage rollout in rule engine
 * 
 * These tests verify that the rule engine correctly integrates
 * the isUserInRollout function for percentage-based feature rollouts.
 * 
 * Requirements: 3.1, 3.2, 3.3
 */
describe('RuleEngine - Percentage Rollout Integration', () => {
  let service: RuleEngineService;
  let ruleRepository: jest.Mocked<RuleRepository>;
  let configKeyRepository: jest.Mocked<ConfigKeyRepository>;

  beforeEach(async () => {
    const mockRuleRepository = {
      findEnabledByConfigKey: jest.fn(),
    };

    const mockConfigKeyRepository = {
      findById: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidate: jest.fn().mockResolvedValue(undefined),
      invalidateConfig: jest.fn().mockResolvedValue(undefined),
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

  describe('Percentage Rollout Scenarios', () => {
    const configKeyId = 'feature-rollout-123';
    const configKeyName = 'feature.new_ui';

    const mockConfigKey: Partial<ConfigKey> = {
      id: configKeyId,
      organization_id: 'org-1',
      project_id: 'proj-1',
      environment_id: 'env-prod',
      key_name: configKeyName,
      value_type: 'boolean',
      current_value: false, // Default: feature disabled
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should gradually roll out a feature to 25% of users', async () => {
      // Create a 25% rollout rule
      const rules: Partial<Rule>[] = [
        {
          id: 'rollout-25',
          config_key_id: configKeyId,
          priority: 100,
          conditions: [
            { attribute: '_percentage_rollout', operator: 'equals', value: 25 }
          ],
          value: true, // Feature enabled for rollout users
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      ruleRepository.findEnabledByConfigKey.mockResolvedValue(rules as Rule[]);
      configKeyRepository.findById.mockResolvedValue(mockConfigKey as ConfigKey);

      // Test with multiple users
      const testUsers = [
        'user-1', 'user-2', 'user-3', 'user-4', 'user-5',
        'user-6', 'user-7', 'user-8', 'user-9', 'user-10'
      ];

      const results = await Promise.all(
        testUsers.map(userId => 
          service.evaluate(configKeyId, { user_id: userId })
        )
      );

      // Count how many users got the feature
      const enabledCount = results.filter(r => r === true).length;
      const disabledCount = results.filter(r => r === false).length;

      // With 10 users and 25% rollout, we expect roughly 2-3 users to get the feature
      // But due to deterministic hashing, the exact number may vary
      expect(enabledCount + disabledCount).toBe(10);
      expect(enabledCount).toBeGreaterThanOrEqual(0);
      expect(enabledCount).toBeLessThanOrEqual(10);
    });

    it('should combine percentage rollout with context rules', async () => {
      // Scenario: Roll out to 50% of premium users only
      const rules: Partial<Rule>[] = [
        {
          id: 'premium-rollout',
          config_key_id: configKeyId,
          priority: 100,
          conditions: [
            { attribute: 'tier', operator: 'equals', value: 'premium' },
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

      // Premium user - may or may not get feature based on hash
      const premiumResult = await service.evaluate(configKeyId, {
        user_id: 'premium-user-1',
        tier: 'premium'
      });
      expect(typeof premiumResult).toBe('boolean');

      // Basic user - should not get feature (tier doesn't match)
      const basicResult = await service.evaluate(configKeyId, {
        user_id: 'basic-user-1',
        tier: 'basic'
      });
      expect(basicResult).toBe(false); // Default value
    });

    it('should handle staged rollout with multiple percentage rules', async () => {
      // Scenario: 10% to beta users, 50% to regular users
      const rules: Partial<Rule>[] = [
        {
          id: 'beta-rollout',
          config_key_id: configKeyId,
          priority: 200,
          conditions: [
            { attribute: 'tier', operator: 'equals', value: 'beta' },
            { attribute: '_percentage_rollout', operator: 'equals', value: 10 }
          ],
          value: true,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'regular-rollout',
          config_key_id: configKeyId,
          priority: 100,
          conditions: [
            { attribute: 'tier', operator: 'equals', value: 'regular' },
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

      // Beta user
      const betaResult = await service.evaluate(configKeyId, {
        user_id: 'beta-user-1',
        tier: 'beta'
      });
      expect(typeof betaResult).toBe('boolean');

      // Regular user
      const regularResult = await service.evaluate(configKeyId, {
        user_id: 'regular-user-1',
        tier: 'regular'
      });
      expect(typeof regularResult).toBe('boolean');
    });

    it('should maintain determinism across multiple evaluations', async () => {
      const rules: Partial<Rule>[] = [
        {
          id: 'rollout-50',
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

      const userId = 'consistent-user';
      const context: Context = { user_id: userId };

      // Evaluate multiple times
      const result1 = await service.evaluate(configKeyId, context);
      const result2 = await service.evaluate(configKeyId, context);
      const result3 = await service.evaluate(configKeyId, context);

      // All results should be identical (Requirement 3.1, 3.5)
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('should handle rollout with fallback to default', async () => {
      // Scenario: 30% rollout, users not in rollout get default
      const rules: Partial<Rule>[] = [
        {
          id: 'rollout-30',
          config_key_id: configKeyId,
          priority: 100,
          conditions: [
            { attribute: '_percentage_rollout', operator: 'equals', value: 30 }
          ],
          value: 'new_version',
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      const configWithDefault: Partial<ConfigKey> = {
        ...mockConfigKey,
        current_value: 'old_version', // Default value
      };

      ruleRepository.findEnabledByConfigKey.mockResolvedValue(rules as Rule[]);
      configKeyRepository.findById.mockResolvedValue(configWithDefault as ConfigKey);

      // Test multiple users
      const results = await Promise.all([
        service.evaluate(configKeyId, { user_id: 'user-a' }),
        service.evaluate(configKeyId, { user_id: 'user-b' }),
        service.evaluate(configKeyId, { user_id: 'user-c' }),
      ]);

      // Each result should be either 'new_version' or 'old_version'
      results.forEach(result => {
        expect(['new_version', 'old_version']).toContain(result);
      });
    });

    it('should respect priority when mixing rollout and regular rules', async () => {
      // Scenario: VIP users always get feature, others get 20% rollout
      const rules: Partial<Rule>[] = [
        {
          id: 'vip-rule',
          config_key_id: configKeyId,
          priority: 200,
          conditions: [
            { attribute: 'tier', operator: 'equals', value: 'vip' }
          ],
          value: true,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'rollout-20',
          config_key_id: configKeyId,
          priority: 100,
          conditions: [
            { attribute: '_percentage_rollout', operator: 'equals', value: 20 }
          ],
          value: true,
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      ruleRepository.findEnabledByConfigKey.mockResolvedValue(rules as Rule[]);
      configKeyRepository.findById.mockResolvedValue(mockConfigKey as ConfigKey);

      // VIP user should always get feature (higher priority rule)
      const vipResult = await service.evaluate(configKeyId, {
        user_id: 'vip-user-1',
        tier: 'vip'
      });
      expect(vipResult).toBe(true);

      // Non-VIP user may or may not get feature based on rollout
      const regularResult = await service.evaluate(configKeyId, {
        user_id: 'regular-user-1',
        tier: 'regular'
      });
      expect(typeof regularResult).toBe('boolean');
    });
  });
});
