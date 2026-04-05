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
 * Property-Based Tests for AND Logic in Conditions
 * 
 * **Validates: Requirements 4.6**
 * 
 * Property 15: Multiple conditions use AND logic
 * For any rule with N conditions, the rule should only match when all N conditions
 * evaluate to true.
 */
describe('Property Test: AND Logic in Conditions', () => {
  let ruleEngineService: RuleEngineService;
  let mockRuleRepository: Partial<RuleRepository>;
  let mockConfigKeyRepository: Partial<ConfigKeyRepository>;
  let mockCacheService: any;
  let mockAuditLogService: any;

  beforeEach(async () => {
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
   * Property 15.1: Rule with multiple conditions matches only when all conditions are true
   * 
   * For any rule with N conditions, the rule should match when all N conditions
   * evaluate to true, and not match when any condition evaluates to false.
   */
  it('should match rule only when all conditions are true', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.string(),
        fc.string(),
        fc.integer({ min: 1, max: 100 }),
        async (
          configKeyId: string,
          keyName: string,
          region: string,
          tier: string,
          appVersion: number,
        ) => {
          const defaultValue = 'default';

          // Create a rule with 3 conditions (all must match)
          const rule: Rule = {
            id: 'rule-1',
            config_key_id: configKeyId,
            priority: 100,
            conditions: [
              {
                attribute: 'region',
                operator: 'equals',
                value: region,
              },
              {
                attribute: 'tier',
                operator: 'equals',
                value: tier,
              },
              {
                attribute: 'app_version',
                operator: 'greater_than',
                value: appVersion - 1,
              },
            ],
            value: 'matched',
            enabled: true,
            created_at: new Date(),
            updated_at: new Date(),
          } as Rule;

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

          (mockRuleRepository.findEnabledByConfigKey as jest.Mock).mockResolvedValue([rule]);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);

          // Test 1: All conditions match - should return rule value
          const allMatchContext: Context = {
            region: region,
            tier: tier,
            app_version: String(appVersion),
          };

          const allMatchResult = await ruleEngineService.evaluate(configKeyId, allMatchContext);
          expect(allMatchResult).toBe('matched');

          // Test 2: First condition doesn't match - should return default
          const firstFailContext: Context = {
            region: region + '_different',
            tier: tier,
            app_version: String(appVersion),
          };

          const firstFailResult = await ruleEngineService.evaluate(configKeyId, firstFailContext);
          expect(firstFailResult).toBe(defaultValue);

          // Test 3: Second condition doesn't match - should return default
          const secondFailContext: Context = {
            region: region,
            tier: tier + '_different',
            app_version: String(appVersion),
          };

          const secondFailResult = await ruleEngineService.evaluate(configKeyId, secondFailContext);
          expect(secondFailResult).toBe(defaultValue);

          // Test 4: Third condition doesn't match - should return default
          if (appVersion > 1) {
            const thirdFailContext: Context = {
              region: region,
              tier: tier,
              app_version: String(appVersion - 2),
            };

            const thirdFailResult = await ruleEngineService.evaluate(configKeyId, thirdFailContext);
            expect(thirdFailResult).toBe(defaultValue);
          }
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 15.2: Rule with two conditions uses AND logic
   * 
   * Tests that a rule with exactly 2 conditions only matches when both are true.
   */
  it('should match rule with 2 conditions only when both are true', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.string(),
        fc.string(),
        fc.string(),
        fc.string(),
        async (
          configKeyId: string,
          keyName: string,
          matchValue1: string,
          matchValue2: string,
          nonMatchValue1: string,
          nonMatchValue2: string,
        ) => {
          // Ensure values are different
          if (matchValue1 === nonMatchValue1 || matchValue2 === nonMatchValue2) {
            return;
          }

          const defaultValue = 'default';

          const rule: Rule = {
            id: 'rule-1',
            config_key_id: configKeyId,
            priority: 100,
            conditions: [
              {
                attribute: 'custom_attributes.attr1',
                operator: 'equals',
                value: matchValue1,
              },
              {
                attribute: 'custom_attributes.attr2',
                operator: 'equals',
                value: matchValue2,
              },
            ],
            value: 'matched',
            enabled: true,
            created_at: new Date(),
            updated_at: new Date(),
          } as Rule;

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

          (mockRuleRepository.findEnabledByConfigKey as jest.Mock).mockResolvedValue([rule]);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);

          // Both conditions match
          const bothMatchContext: Context = {
            custom_attributes: {
              attr1: matchValue1,
              attr2: matchValue2,
            },
          };
          const bothMatchResult = await ruleEngineService.evaluate(configKeyId, bothMatchContext);
          expect(bothMatchResult).toBe('matched');

          // Only first condition matches
          const firstOnlyContext: Context = {
            custom_attributes: {
              attr1: matchValue1,
              attr2: nonMatchValue2,
            },
          };
          const firstOnlyResult = await ruleEngineService.evaluate(configKeyId, firstOnlyContext);
          expect(firstOnlyResult).toBe(defaultValue);

          // Only second condition matches
          const secondOnlyContext: Context = {
            custom_attributes: {
              attr1: nonMatchValue1,
              attr2: matchValue2,
            },
          };
          const secondOnlyResult = await ruleEngineService.evaluate(configKeyId, secondOnlyContext);
          expect(secondOnlyResult).toBe(defaultValue);

          // Neither condition matches
          const neitherContext: Context = {
            custom_attributes: {
              attr1: nonMatchValue1,
              attr2: nonMatchValue2,
            },
          };
          const neitherResult = await ruleEngineService.evaluate(configKeyId, neitherContext);
          expect(neitherResult).toBe(defaultValue);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 15.3: Rule with many conditions requires all to match
   * 
   * Tests that a rule with N conditions (where N > 2) only matches when all N
   * conditions are true.
   */
  it('should match rule with many conditions only when all are true', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.array(fc.string(), { minLength: 3, maxLength: 10 }),
        fc.integer({ min: 0, max: 9 }), // index of condition to fail
        async (
          configKeyId: string,
          keyName: string,
          values: string[],
          failIndex: number,
        ) => {
          // Ensure we have enough unique values
          const uniqueValues = Array.from(new Set(values));
          if (uniqueValues.length < 3) {
            return;
          }

          const numConditions = Math.min(uniqueValues.length, 10);
          const defaultValue = 'default';

          // Create a rule with N conditions
          const conditions = uniqueValues.slice(0, numConditions).map((value, index) => ({
            attribute: `custom_attributes.attr${index}`,
            operator: 'equals' as const,
            value: value,
          }));

          const rule: Rule = {
            id: 'rule-1',
            config_key_id: configKeyId,
            priority: 100,
            conditions: conditions,
            value: 'matched',
            enabled: true,
            created_at: new Date(),
            updated_at: new Date(),
          } as Rule;

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

          (mockRuleRepository.findEnabledByConfigKey as jest.Mock).mockResolvedValue([rule]);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);

          // Test 1: All conditions match - should return rule value
          const allMatchAttrs: Record<string, any> = {};
          uniqueValues.slice(0, numConditions).forEach((value, index) => {
            allMatchAttrs[`attr${index}`] = value;
          });

          const allMatchContext: Context = {
            custom_attributes: allMatchAttrs,
          };

          const allMatchResult = await ruleEngineService.evaluate(configKeyId, allMatchContext);
          expect(allMatchResult).toBe('matched');

          // Test 2: One condition fails - should return default
          const oneFailAttrs: Record<string, any> = { ...allMatchAttrs };
          const failIndexMod = failIndex % numConditions;
          oneFailAttrs[`attr${failIndexMod}`] = uniqueValues[failIndexMod] + '_different';

          const oneFailContext: Context = {
            custom_attributes: oneFailAttrs,
          };

          const oneFailResult = await ruleEngineService.evaluate(configKeyId, oneFailContext);
          expect(oneFailResult).toBe(defaultValue);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 15.4: AND logic works with different operators
   * 
   * Tests that AND logic works correctly when conditions use different operators.
   */
  it('should apply AND logic across conditions with different operators', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.string(),
        fc.array(fc.string(), { minLength: 2, maxLength: 5 }),
        fc.integer({ min: 50, max: 100 }),
        async (
          configKeyId: string,
          keyName: string,
          regionValue: string,
          allowedTiers: string[],
          versionThreshold: number,
        ) => {
          const defaultValue = 'default';

          // Create a rule with conditions using different operators
          const rule: Rule = {
            id: 'rule-1',
            config_key_id: configKeyId,
            priority: 100,
            conditions: [
              {
                attribute: 'region',
                operator: 'equals',
                value: regionValue,
              },
              {
                attribute: 'tier',
                operator: 'in_list',
                value: allowedTiers,
              },
              {
                attribute: 'app_version',
                operator: 'greater_than',
                value: versionThreshold,
              },
            ],
            value: 'matched',
            enabled: true,
            created_at: new Date(),
            updated_at: new Date(),
          } as Rule;

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

          (mockRuleRepository.findEnabledByConfigKey as jest.Mock).mockResolvedValue([rule]);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);

          // All conditions match
          const allMatchContext: Context = {
            region: regionValue,
            tier: allowedTiers[0],
            app_version: String(versionThreshold + 1),
          };
          const allMatchResult = await ruleEngineService.evaluate(configKeyId, allMatchContext);
          expect(allMatchResult).toBe('matched');

          // First condition fails (equals)
          const firstFailContext: Context = {
            region: regionValue + '_different',
            tier: allowedTiers[0],
            app_version: String(versionThreshold + 1),
          };
          const firstFailResult = await ruleEngineService.evaluate(configKeyId, firstFailContext);
          expect(firstFailResult).toBe(defaultValue);

          // Second condition fails (in_list)
          const secondFailContext: Context = {
            region: regionValue,
            tier: 'not-in-list',
            app_version: String(versionThreshold + 1),
          };
          const secondFailResult = await ruleEngineService.evaluate(configKeyId, secondFailContext);
          expect(secondFailResult).toBe(defaultValue);

          // Third condition fails (greater_than)
          const thirdFailContext: Context = {
            region: regionValue,
            tier: allowedTiers[0],
            app_version: String(versionThreshold - 1),
          };
          const thirdFailResult = await ruleEngineService.evaluate(configKeyId, thirdFailContext);
          expect(thirdFailResult).toBe(defaultValue);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 15.5: AND logic with missing context attributes
   * 
   * Tests that when a context is missing an attribute required by a condition,
   * the rule does not match (AND logic fails).
   */
  it('should not match when context is missing required attributes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.string(),
        fc.string(),
        async (
          configKeyId: string,
          keyName: string,
          value1: string,
          value2: string,
        ) => {
          const defaultValue = 'default';

          const rule: Rule = {
            id: 'rule-1',
            config_key_id: configKeyId,
            priority: 100,
            conditions: [
              {
                attribute: 'region',
                operator: 'equals',
                value: value1,
              },
              {
                attribute: 'tier',
                operator: 'equals',
                value: value2,
              },
            ],
            value: 'matched',
            enabled: true,
            created_at: new Date(),
            updated_at: new Date(),
          } as Rule;

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

          (mockRuleRepository.findEnabledByConfigKey as jest.Mock).mockResolvedValue([rule]);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);

          // Context missing 'tier' attribute
          const missingTierContext: Context = {
            region: value1,
          };
          const missingTierResult = await ruleEngineService.evaluate(configKeyId, missingTierContext);
          expect(missingTierResult).toBe(defaultValue);

          // Context missing 'region' attribute
          const missingRegionContext: Context = {
            tier: value2,
          };
          const missingRegionResult = await ruleEngineService.evaluate(configKeyId, missingRegionContext);
          expect(missingRegionResult).toBe(defaultValue);

          // Context missing both attributes
          const missingBothContext: Context = {};
          const missingBothResult = await ruleEngineService.evaluate(configKeyId, missingBothContext);
          expect(missingBothResult).toBe(defaultValue);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 15.6: AND logic with nested custom attributes
   * 
   * Tests that AND logic works correctly with nested custom_attributes.
   */
  it('should apply AND logic with nested custom attributes', async () => {
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
          value1: string,
          value2: string,
          value3: string,
        ) => {
          const defaultValue = 'default';

          const rule: Rule = {
            id: 'rule-1',
            config_key_id: configKeyId,
            priority: 100,
            conditions: [
              {
                attribute: 'region',
                operator: 'equals',
                value: value1,
              },
              {
                attribute: 'custom_attributes.feature_flag',
                operator: 'equals',
                value: value2,
              },
              {
                attribute: 'custom_attributes.user_segment',
                operator: 'equals',
                value: value3,
              },
            ],
            value: 'matched',
            enabled: true,
            created_at: new Date(),
            updated_at: new Date(),
          } as Rule;

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

          (mockRuleRepository.findEnabledByConfigKey as jest.Mock).mockResolvedValue([rule]);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);

          // All conditions match
          const allMatchContext: Context = {
            region: value1,
            custom_attributes: {
              feature_flag: value2,
              user_segment: value3,
            },
          };
          const allMatchResult = await ruleEngineService.evaluate(configKeyId, allMatchContext);
          expect(allMatchResult).toBe('matched');

          // One custom attribute doesn't match
          const oneFailContext: Context = {
            region: value1,
            custom_attributes: {
              feature_flag: value2 + '_different',
              user_segment: value3,
            },
          };
          const oneFailResult = await ruleEngineService.evaluate(configKeyId, oneFailContext);
          expect(oneFailResult).toBe(defaultValue);

          // Missing one custom attribute
          const missingAttrContext: Context = {
            region: value1,
            custom_attributes: {
              feature_flag: value2,
              // user_segment is missing
            },
          };
          const missingAttrResult = await ruleEngineService.evaluate(configKeyId, missingAttrContext);
          expect(missingAttrResult).toBe(defaultValue);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 15.7: AND logic is consistent across multiple evaluations
   * 
   * Tests that AND logic produces consistent results for the same context.
   */
  it('should produce consistent results for the same context', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.string(),
        fc.string(),
        fc.integer({ min: 1, max: 100 }),
        async (
          configKeyId: string,
          keyName: string,
          region: string,
          tier: string,
          appVersion: number,
        ) => {
          const defaultValue = 'default';

          const rule: Rule = {
            id: 'rule-1',
            config_key_id: configKeyId,
            priority: 100,
            conditions: [
              {
                attribute: 'region',
                operator: 'equals',
                value: region,
              },
              {
                attribute: 'tier',
                operator: 'equals',
                value: tier,
              },
              {
                attribute: 'app_version',
                operator: 'greater_than',
                value: appVersion - 1,
              },
            ],
            value: 'matched',
            enabled: true,
            created_at: new Date(),
            updated_at: new Date(),
          } as Rule;

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

          (mockRuleRepository.findEnabledByConfigKey as jest.Mock).mockResolvedValue([rule]);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);

          const context: Context = {
            region: region,
            tier: tier,
            app_version: String(appVersion),
          };

          // Evaluate multiple times
          const result1 = await ruleEngineService.evaluate(configKeyId, context);
          const result2 = await ruleEngineService.evaluate(configKeyId, context);
          const result3 = await ruleEngineService.evaluate(configKeyId, context);

          // All results should be identical
          expect(result1).toBe(result2);
          expect(result1).toBe(result3);
          expect(result1).toBe('matched');
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });
});
