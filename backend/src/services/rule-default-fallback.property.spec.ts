import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { RuleEngineService } from './rule-engine.service';
import { RuleRepository } from '../repositories/rule.repository';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { Rule } from '../entities/rule.entity';
import { ConfigKey } from '../entities/config-key.entity';
import { Context } from '../types/models';
import { AuditLogService } from './audit-log.service';

/**
 * Property-Based Tests for Default Value Fallback
 * 
 * **Validates: Requirements 4.4**
 * 
 * Property 13: Default value returned when no rules match
 * For any config key and context where no enabled rules match, the rule engine
 * should return the config key's default value.
 */
describe('Property Test: Default Value Fallback', () => {
  let ruleEngineService: RuleEngineService;
  let mockRuleRepository: Partial<RuleRepository>;
  let mockConfigKeyRepository: Partial<ConfigKeyRepository>;
  let mockCacheService: any;
  let mockAuditLogService: any;

  beforeEach(async () => {
    // Mock repositories
    mockRuleRepository = {
      findEnabledByConfigKey: jest.fn(),
    };

    mockConfigKeyRepository = {
      findById: jest.fn(),
    };

    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidate: jest.fn().mockResolvedValue(undefined),
      invalidateConfig: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockAuditLogService = {
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

    ruleEngineService = module.get<RuleEngineService>(RuleEngineService);
  });

  /**
   * Property 13: Default value returned when no rules match
   * 
   * This property tests that for ANY config key and context where no rules match,
   * the rule engine returns the config key's default value.
   */
  it('should return default value when no rules match the context', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // configKeyId
        fc.string({ minLength: 1, maxLength: 255 }), // keyName
        fc.oneof(fc.string(), fc.boolean(), fc.integer(), fc.object()), // defaultValue
        fc.string(), // contextValue that won't match any rules
        fc.string(), // ruleValue that rules will check for (different from contextValue)
        fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 10 }), // priorities
        async (
          configKeyId: string,
          keyName: string,
          defaultValue: any,
          contextValue: string,
          ruleValue: string,
          priorities: number[],
        ) => {
          // Ensure contextValue and ruleValue are different so rules won't match
          if (contextValue === ruleValue) {
            return;
          }

          // Create rules that will NOT match the context
          // All rules check for ruleValue, but context has contextValue
          const rules: Rule[] = priorities.map((priority, index) => ({
            id: `rule-${index}`,
            config_key_id: configKeyId,
            priority: priority,
            conditions: [
              {
                attribute: 'region',
                operator: 'equals' as const,
                value: ruleValue, // This won't match contextValue
              },
            ],
            value: `rule-value-${priority}`,
            enabled: true,
            created_at: new Date(),
            updated_at: new Date(),
          } as Rule));

          // Mock config key with default value
          const mockConfigKey: ConfigKey = {
            id: configKeyId,
            organization_id: 'org-1',
            project_id: 'proj-1',
            environment_id: 'env-1',
            key_name: keyName,
            value_type: typeof defaultValue === 'object' ? 'json' : typeof defaultValue as any,
            current_value: defaultValue,
            created_at: new Date(),
            updated_at: new Date(),
          } as ConfigKey;

          // Mock repository responses
          (mockRuleRepository.findEnabledByConfigKey as jest.Mock).mockResolvedValue(rules);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);

          // Create context that won't match any rules
          const context: Context = {
            region: contextValue,
          };

          // Act: Evaluate rules
          const result = await ruleEngineService.evaluate(configKeyId, context);

          // Property: Result should be the default value since no rules matched
          expect(result).toEqual(defaultValue);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 13 (Extended): Default value returned when no rules exist
   * 
   * Tests that when a config key has no rules at all, the default value is returned.
   */
  it('should return default value when no rules exist for config key', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.oneof(fc.string(), fc.boolean(), fc.integer(), fc.object()),
        fc.record({
          region: fc.string(),
          tier: fc.string(),
          user_id: fc.string(),
        }),
        async (
          configKeyId: string,
          keyName: string,
          defaultValue: any,
          contextAttrs: Record<string, string>,
        ) => {
          const mockConfigKey: ConfigKey = {
            id: configKeyId,
            organization_id: 'org-1',
            project_id: 'proj-1',
            environment_id: 'env-1',
            key_name: keyName,
            value_type: typeof defaultValue === 'object' ? 'json' : typeof defaultValue as any,
            current_value: defaultValue,
            created_at: new Date(),
            updated_at: new Date(),
          } as ConfigKey;

          // No rules exist
          (mockRuleRepository.findEnabledByConfigKey as jest.Mock).mockResolvedValue([]);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);

          const context: Context = contextAttrs;

          const result = await ruleEngineService.evaluate(configKeyId, context);

          // Property: Should return default value when no rules exist
          expect(result).toEqual(defaultValue);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 13 (Extended): Default value returned when all rules are disabled
   * 
   * Tests that when all rules are disabled, the default value is returned.
   */
  it('should return default value when all rules are disabled', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.string(),
        fc.string(),
        fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 5 }),
        async (
          configKeyId: string,
          keyName: string,
          defaultValue: string,
          contextValue: string,
          priorities: number[],
        ) => {
          // Create rules that would match, but are all disabled
          const rules: Rule[] = priorities.map((priority, index) => ({
            id: `rule-${index}`,
            config_key_id: configKeyId,
            priority: priority,
            conditions: [
              {
                attribute: 'region',
                operator: 'equals' as const,
                value: contextValue,
              },
            ],
            value: `rule-value-${priority}`,
            enabled: false, // All disabled
            created_at: new Date(),
            updated_at: new Date(),
          } as Rule));

          const mockConfigKey: ConfigKey = {
            id: configKeyId,
            organization_id: 'org-1',
            project_id: 'proj-1',
            environment_id: 'env-1',
            key_name: keyName,
            value_type: 'string',
            current_value: defaultValue,
            created_at: new Date(),
            updated_at: new Date(),
          } as ConfigKey;

          // findEnabledByConfigKey should filter out disabled rules
          const enabledRules = rules.filter(r => r.enabled);
          (mockRuleRepository.findEnabledByConfigKey as jest.Mock).mockResolvedValue(enabledRules);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);

          const context: Context = {
            region: contextValue,
          };

          const result = await ruleEngineService.evaluate(configKeyId, context);

          // Property: Should return default value when all rules are disabled
          expect(result).toBe(defaultValue);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 13 (Extended): Default value returned when rules have partial matches
   * 
   * Tests that when rules have multiple conditions and only some match,
   * the default value is returned.
   */
  it('should return default value when rules have partial condition matches', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.string({ minLength: 1 }), // Ensure non-empty
        fc.string({ minLength: 1 }), // Ensure non-empty
        fc.string({ minLength: 1 }), // Ensure non-empty
        fc.string({ minLength: 1 }), // Ensure non-empty
        async (
          configKeyId: string,
          keyName: string,
          defaultValue: string,
          matchingValue: string,
          nonMatchingValue: string,
          ruleValue: string,
        ) => {
          // Ensure all values are different
          if (matchingValue === nonMatchingValue || 
              matchingValue === ruleValue || 
              nonMatchingValue === ruleValue) {
            return;
          }

          // Create a rule with multiple conditions where only one will match
          const rules: Rule[] = [
            {
              id: 'rule-1',
              config_key_id: configKeyId,
              priority: 100,
              conditions: [
                {
                  attribute: 'region',
                  operator: 'equals' as const,
                  value: matchingValue, // This will match
                },
                {
                  attribute: 'tier',
                  operator: 'equals' as const,
                  value: ruleValue, // This won't match
                },
              ],
              value: 'rule-value',
              enabled: true,
              created_at: new Date(),
              updated_at: new Date(),
            } as Rule,
          ];

          const mockConfigKey: ConfigKey = {
            id: configKeyId,
            organization_id: 'org-1',
            project_id: 'proj-1',
            environment_id: 'env-1',
            key_name: keyName,
            value_type: 'string',
            current_value: defaultValue,
            created_at: new Date(),
            updated_at: new Date(),
          } as ConfigKey;

          (mockRuleRepository.findEnabledByConfigKey as jest.Mock).mockResolvedValue(rules);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);

          // Context matches first condition but not second
          const context: Context = {
            region: matchingValue,
            tier: nonMatchingValue,
          };

          const result = await ruleEngineService.evaluate(configKeyId, context);

          // Property: Should return default value when not all conditions match (AND logic)
          expect(result).toBe(defaultValue);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 13 (Extended): Default value returned for percentage rollout without user_id
   * 
   * Tests that percentage rollout rules without user_id in context fall back to default.
   */
  it('should return default value for percentage rollout when user_id is missing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.string(),
        fc.integer({ min: 1, max: 99 }), // percentage (not 0 or 100)
        async (
          configKeyId: string,
          keyName: string,
          defaultValue: string,
          percentage: number,
        ) => {
          // Create a percentage rollout rule
          const rules: Rule[] = [
            {
              id: 'rollout-rule',
              config_key_id: configKeyId,
              priority: 100,
              conditions: [
                {
                  attribute: '_percentage_rollout',
                  operator: 'equals' as const,
                  value: percentage,
                },
              ],
              value: 'rollout-value',
              enabled: true,
              created_at: new Date(),
              updated_at: new Date(),
            } as Rule,
          ];

          const mockConfigKey: ConfigKey = {
            id: configKeyId,
            organization_id: 'org-1',
            project_id: 'proj-1',
            environment_id: 'env-1',
            key_name: keyName,
            value_type: 'string',
            current_value: defaultValue,
            created_at: new Date(),
            updated_at: new Date(),
          } as ConfigKey;

          (mockRuleRepository.findEnabledByConfigKey as jest.Mock).mockResolvedValue(rules);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);

          // Context without user_id
          const context: Context = {
            region: 'us-east-1',
          };

          const result = await ruleEngineService.evaluate(configKeyId, context);

          // Property: Should return default value when user_id is missing for percentage rollout
          expect(result).toBe(defaultValue);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 13 (Extended): Default value returned when context is empty
   * 
   * Tests that when context is empty and rules exist, default value is returned.
   */
  it('should return default value when context is empty', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.oneof(fc.string(), fc.boolean(), fc.integer()),
        fc.string(),
        async (
          configKeyId: string,
          keyName: string,
          defaultValue: any,
          ruleValue: string,
        ) => {
          // Create rules that require context attributes
          const rules: Rule[] = [
            {
              id: 'rule-1',
              config_key_id: configKeyId,
              priority: 100,
              conditions: [
                {
                  attribute: 'region',
                  operator: 'equals' as const,
                  value: ruleValue,
                },
              ],
              value: 'rule-value',
              enabled: true,
              created_at: new Date(),
              updated_at: new Date(),
            } as Rule,
          ];

          const mockConfigKey: ConfigKey = {
            id: configKeyId,
            organization_id: 'org-1',
            project_id: 'proj-1',
            environment_id: 'env-1',
            key_name: keyName,
            value_type: typeof defaultValue === 'object' ? 'json' : typeof defaultValue as any,
            current_value: defaultValue,
            created_at: new Date(),
            updated_at: new Date(),
          } as ConfigKey;

          (mockRuleRepository.findEnabledByConfigKey as jest.Mock).mockResolvedValue(rules);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);

          // Empty context
          const context: Context = {};

          const result = await ruleEngineService.evaluate(configKeyId, context);

          // Property: Should return default value when context is empty
          expect(result).toEqual(defaultValue);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 13 (Extended): Default value type is preserved
   * 
   * Tests that the default value is returned with its original type intact.
   */
  it('should preserve default value type when returning it', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.oneof(
          fc.string(),
          fc.boolean(),
          fc.integer(),
          fc.constant({ key: 'value' }),
          fc.constant([1, 2, 3]),
        ),
        async (
          configKeyId: string,
          keyName: string,
          defaultValue: any,
        ) => {
          const mockConfigKey: ConfigKey = {
            id: configKeyId,
            organization_id: 'org-1',
            project_id: 'proj-1',
            environment_id: 'env-1',
            key_name: keyName,
            value_type: typeof defaultValue === 'object' ? 'json' : typeof defaultValue as any,
            current_value: defaultValue,
            created_at: new Date(),
            updated_at: new Date(),
          } as ConfigKey;

          // No rules
          (mockRuleRepository.findEnabledByConfigKey as jest.Mock).mockResolvedValue([]);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);

          const context: Context = { region: 'us-east-1' };

          const result = await ruleEngineService.evaluate(configKeyId, context);

          // Property: Type should be preserved
          expect(typeof result).toBe(typeof defaultValue);
          expect(result).toEqual(defaultValue);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 13 (Extended): Default value returned consistently
   * 
   * Tests that the same context always returns the same default value (deterministic).
   */
  it('should return default value consistently across multiple evaluations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.string(),
        fc.string(),
        fc.string(),
        async (
          configKeyId: string,
          keyName: string,
          defaultValue: string,
          contextValue: string,
          ruleValue: string,
        ) => {
          // Ensure they're different
          if (contextValue === ruleValue) {
            return;
          }

          const rules: Rule[] = [
            {
              id: 'rule-1',
              config_key_id: configKeyId,
              priority: 100,
              conditions: [
                {
                  attribute: 'region',
                  operator: 'equals' as const,
                  value: ruleValue,
                },
              ],
              value: 'rule-value',
              enabled: true,
              created_at: new Date(),
              updated_at: new Date(),
            } as Rule,
          ];

          const mockConfigKey: ConfigKey = {
            id: configKeyId,
            organization_id: 'org-1',
            project_id: 'proj-1',
            environment_id: 'env-1',
            key_name: keyName,
            value_type: 'string',
            current_value: defaultValue,
            created_at: new Date(),
            updated_at: new Date(),
          } as ConfigKey;

          (mockRuleRepository.findEnabledByConfigKey as jest.Mock).mockResolvedValue(rules);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);

          const context: Context = {
            region: contextValue,
          };

          // Evaluate multiple times
          const result1 = await ruleEngineService.evaluate(configKeyId, context);
          const result2 = await ruleEngineService.evaluate(configKeyId, context);
          const result3 = await ruleEngineService.evaluate(configKeyId, context);

          // Property: All results should be identical and equal to default value
          expect(result1).toBe(defaultValue);
          expect(result2).toBe(defaultValue);
          expect(result3).toBe(defaultValue);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });
});
