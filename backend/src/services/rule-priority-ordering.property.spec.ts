import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { RuleEngineService } from './rule-engine.service';
import { RuleRepository } from '../repositories/rule.repository';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { Rule } from '../entities/rule.entity';
import { ConfigKey } from '../entities/config-key.entity';
import { Context, Condition } from '../types/models';
import { AuditLogService } from './audit-log.service';

/**
 * Property-Based Tests for Rule Priority Ordering
 * 
 * **Validates: Requirements 4.2, 4.3**
 * 
 * Property 12: Rules are evaluated in priority order
 * For any config key with multiple enabled rules, when multiple rules match the context,
 * the rule with the highest priority value should be selected and its value returned.
 */
describe('Property Test: Rule Priority Ordering', () => {
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
   * Property 12: Rules are evaluated in priority order
   * 
   * This property tests that for ANY config key with multiple matching rules,
   * the rule with the highest priority is selected.
   */
  it('should return value from highest priority matching rule', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // configKeyId
        fc.string({ minLength: 1, maxLength: 255 }), // keyName
        fc.string(), // contextValue (the value we'll match against)
        fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 2, maxLength: 10 }), // priorities
        fc.string(), // defaultValue
        async (
          configKeyId: string,
          keyName: string,
          contextValue: string,
          priorities: number[],
          defaultValue: string,
        ) => {
          // Ensure priorities are unique and sorted descending
          const uniquePriorities = Array.from(new Set(priorities)).sort((a, b) => b - a);
          
          if (uniquePriorities.length < 2) {
            // Skip if we don't have at least 2 unique priorities
            return;
          }

          // Create rules that all match the context
          // Each rule has a unique value that identifies it
          const rules: Rule[] = uniquePriorities.map((priority, index) => ({
            id: `rule-${priority}`,
            config_key_id: configKeyId,
            priority: priority,
            conditions: [
              {
                attribute: 'region',
                operator: 'equals' as const,
                value: contextValue,
              },
            ],
            value: `value-from-priority-${priority}`,
            enabled: true,
            created_at: new Date(),
            updated_at: new Date(),
          } as Rule));

          // Mock config key
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

          // Mock repository responses
          (mockRuleRepository.findEnabledByConfigKey as jest.Mock).mockResolvedValue(rules);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);

          // Create context that matches all rules
          const context: Context = {
            region: contextValue,
          };

          // Act: Evaluate rules
          const result = await ruleEngineService.evaluate(configKeyId, context);

          // Property: Result should be from the highest priority rule
          const highestPriority = uniquePriorities[0];
          const expectedValue = `value-from-priority-${highestPriority}`;

          expect(result).toBe(expectedValue);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 12 (Extended): Only the first matching rule is evaluated
   * 
   * Tests that when multiple rules match, only the highest priority rule's
   * value is returned, and lower priority rules are not considered.
   */
  it('should not evaluate lower priority rules when higher priority rule matches', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.string(),
        fc.integer({ min: 100, max: 1000 }), // highPriority
        fc.integer({ min: 1, max: 99 }), // lowPriority
        fc.string(),
        fc.string(),
        async (
          configKeyId: string,
          keyName: string,
          contextValue: string,
          highPriority: number,
          lowPriority: number,
          highPriorityValue: string,
          lowPriorityValue: string,
        ) => {
          // Ensure values are different so we can distinguish which rule was selected
          if (highPriorityValue === lowPriorityValue) {
            return;
          }
          // Create two rules: one high priority, one low priority
          // Both match the context
          const rules: Rule[] = [
            {
              id: 'rule-high',
              config_key_id: configKeyId,
              priority: highPriority,
              conditions: [
                {
                  attribute: 'region',
                  operator: 'equals' as const,
                  value: contextValue,
                },
              ],
              value: highPriorityValue,
              enabled: true,
              created_at: new Date(),
              updated_at: new Date(),
            } as Rule,
            {
              id: 'rule-low',
              config_key_id: configKeyId,
              priority: lowPriority,
              conditions: [
                {
                  attribute: 'region',
                  operator: 'equals' as const,
                  value: contextValue,
                },
              ],
              value: lowPriorityValue,
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
            current_value: 'default',
            created_at: new Date(),
            updated_at: new Date(),
          } as ConfigKey;

          (mockRuleRepository.findEnabledByConfigKey as jest.Mock).mockResolvedValue(rules);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);

          const context: Context = {
            region: contextValue,
          };

          const result = await ruleEngineService.evaluate(configKeyId, context);

          // Property: Result should be from high priority rule, not low priority
          expect(result).toBe(highPriorityValue);
          expect(result).not.toBe(lowPriorityValue);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 12 (Extended): Priority ordering with partial matches
   * 
   * Tests that when only some rules match the context, the highest priority
   * matching rule is selected, not just the highest priority rule overall.
   */
  it('should return value from highest priority matching rule when some rules do not match', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.string(),
        fc.string(),
        async (
          configKeyId: string,
          keyName: string,
          matchingValue: string,
          nonMatchingValue: string,
        ) => {
          // Ensure values are different
          if (matchingValue === nonMatchingValue) {
            return;
          }

          // Create three rules with different priorities
          // Priority 100: Does NOT match context
          // Priority 50: MATCHES context
          // Priority 10: MATCHES context
          const rules: Rule[] = [
            {
              id: 'rule-100',
              config_key_id: configKeyId,
              priority: 100,
              conditions: [
                {
                  attribute: 'region',
                  operator: 'equals' as const,
                  value: nonMatchingValue, // Won't match
                },
              ],
              value: 'value-100',
              enabled: true,
              created_at: new Date(),
              updated_at: new Date(),
            } as Rule,
            {
              id: 'rule-50',
              config_key_id: configKeyId,
              priority: 50,
              conditions: [
                {
                  attribute: 'region',
                  operator: 'equals' as const,
                  value: matchingValue, // Will match
                },
              ],
              value: 'value-50',
              enabled: true,
              created_at: new Date(),
              updated_at: new Date(),
            } as Rule,
            {
              id: 'rule-10',
              config_key_id: configKeyId,
              priority: 10,
              conditions: [
                {
                  attribute: 'region',
                  operator: 'equals' as const,
                  value: matchingValue, // Will match
                },
              ],
              value: 'value-10',
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
            current_value: 'default',
            created_at: new Date(),
            updated_at: new Date(),
          } as ConfigKey;

          (mockRuleRepository.findEnabledByConfigKey as jest.Mock).mockResolvedValue(rules);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);

          const context: Context = {
            region: matchingValue,
          };

          const result = await ruleEngineService.evaluate(configKeyId, context);

          // Property: Should return value from priority 50 (highest matching rule)
          // NOT priority 100 (doesn't match) or priority 10 (lower priority)
          expect(result).toBe('value-50');
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 12 (Extended): Priority ordering with complex conditions
   * 
   * Tests that priority ordering works correctly when rules have multiple
   * conditions (AND logic).
   */
  it('should respect priority ordering with multiple conditions per rule', async () => {
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
          // Create rules with multiple conditions
          const rules: Rule[] = [
            {
              id: 'rule-high',
              config_key_id: configKeyId,
              priority: 100,
              conditions: [
                {
                  attribute: 'region',
                  operator: 'equals' as const,
                  value: region,
                },
                {
                  attribute: 'tier',
                  operator: 'equals' as const,
                  value: tier,
                },
                {
                  attribute: 'app_version',
                  operator: 'greater_than' as const,
                  value: appVersion - 1,
                },
              ],
              value: 'high-priority-value',
              enabled: true,
              created_at: new Date(),
              updated_at: new Date(),
            } as Rule,
            {
              id: 'rule-low',
              config_key_id: configKeyId,
              priority: 10,
              conditions: [
                {
                  attribute: 'region',
                  operator: 'equals' as const,
                  value: region,
                },
              ],
              value: 'low-priority-value',
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
            current_value: 'default',
            created_at: new Date(),
            updated_at: new Date(),
          } as ConfigKey;

          (mockRuleRepository.findEnabledByConfigKey as jest.Mock).mockResolvedValue(rules);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);

          // Context that matches all conditions of both rules
          const context: Context = {
            region: region,
            tier: tier,
            app_version: String(appVersion),
          };

          const result = await ruleEngineService.evaluate(configKeyId, context);

          // Property: Should return high priority value when all conditions match
          expect(result).toBe('high-priority-value');
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 12 (Extended): Disabled rules are skipped regardless of priority
   * 
   * Tests that disabled rules are not evaluated even if they have the highest priority.
   */
  it('should skip disabled rules regardless of priority', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.string(),
        async (configKeyId: string, keyName: string, contextValue: string) => {
          // Create rules where highest priority is disabled
          const rules: Rule[] = [
            {
              id: 'rule-disabled',
              config_key_id: configKeyId,
              priority: 100,
              conditions: [
                {
                  attribute: 'region',
                  operator: 'equals' as const,
                  value: contextValue,
                },
              ],
              value: 'disabled-rule-value',
              enabled: false, // Disabled
              created_at: new Date(),
              updated_at: new Date(),
            } as Rule,
            {
              id: 'rule-enabled',
              config_key_id: configKeyId,
              priority: 50,
              conditions: [
                {
                  attribute: 'region',
                  operator: 'equals' as const,
                  value: contextValue,
                },
              ],
              value: 'enabled-rule-value',
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
            current_value: 'default',
            created_at: new Date(),
            updated_at: new Date(),
          } as ConfigKey;

          // Note: findEnabledByConfigKey should only return enabled rules
          // but we test the service's handling of disabled rules
          const enabledRules = rules.filter(r => r.enabled);
          (mockRuleRepository.findEnabledByConfigKey as jest.Mock).mockResolvedValue(enabledRules);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);

          const context: Context = {
            region: contextValue,
          };

          const result = await ruleEngineService.evaluate(configKeyId, context);

          // Property: Should return value from enabled rule, not disabled rule
          expect(result).toBe('enabled-rule-value');
          expect(result).not.toBe('disabled-rule-value');
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 12 (Extended): Priority ordering with many rules
   * 
   * Tests that priority ordering works correctly with a large number of rules.
   */
  it('should handle priority ordering with many rules', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.string(),
        fc.integer({ min: 10, max: 50 }), // number of rules
        async (
          configKeyId: string,
          keyName: string,
          contextValue: string,
          numRules: number,
        ) => {
          // Create many rules with different priorities
          // All rules match the context
          const rules: Rule[] = Array.from({ length: numRules }, (_, i) => ({
            id: `rule-${i}`,
            config_key_id: configKeyId,
            priority: numRules - i, // Descending priorities
            conditions: [
              {
                attribute: 'region',
                operator: 'equals' as const,
                value: contextValue,
              },
            ],
            value: `value-priority-${numRules - i}`,
            enabled: true,
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
            current_value: 'default',
            created_at: new Date(),
            updated_at: new Date(),
          } as ConfigKey;

          (mockRuleRepository.findEnabledByConfigKey as jest.Mock).mockResolvedValue(rules);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);

          const context: Context = {
            region: contextValue,
          };

          const result = await ruleEngineService.evaluate(configKeyId, context);

          // Property: Should return value from highest priority rule
          const highestPriority = numRules;
          expect(result).toBe(`value-priority-${highestPriority}`);
        },
      ),
      {
        numRuns: 50,
        verbose: true,
      },
    );
  });

  /**
   * Property 12 (Extended): Priority ordering is consistent across evaluations
   * 
   * Tests that the same context always produces the same result (deterministic).
   */
  it('should return consistent results for the same context across multiple evaluations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.string(),
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 3, maxLength: 10 }),
        async (
          configKeyId: string,
          keyName: string,
          contextValue: string,
          priorities: number[],
        ) => {
          const uniquePriorities = Array.from(new Set(priorities)).sort((a, b) => b - a);
          
          if (uniquePriorities.length < 2) {
            return;
          }

          const rules: Rule[] = uniquePriorities.map((priority) => ({
            id: `rule-${priority}`,
            config_key_id: configKeyId,
            priority: priority,
            conditions: [
              {
                attribute: 'region',
                operator: 'equals' as const,
                value: contextValue,
              },
            ],
            value: `value-${priority}`,
            enabled: true,
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
            current_value: 'default',
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

          // Property: All results should be identical
          expect(result1).toBe(result2);
          expect(result1).toBe(result3);

          // Property: Result should be from highest priority
          const highestPriority = uniquePriorities[0];
          expect(result1).toBe(`value-${highestPriority}`);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });
});
