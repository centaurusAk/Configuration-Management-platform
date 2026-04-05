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
 * Property-Based Tests for Rule Operators
 * 
 * **Validates: Requirements 4.5**
 * 
 * Property 14: All rule operators work correctly
 * For any rule condition with operator in {equals, not_equals, in_list, not_in_list,
 * greater_than, less_than, regex_match}, the condition should evaluate correctly
 * according to the operator semantics.
 */
describe('Property Test: Rule Operators', () => {
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
   * Property 14.1: equals operator works correctly
   * 
   * For any value V, a rule with operator 'equals' and value V should match
   * when context contains V, and not match when context contains any other value.
   */
  it('should correctly evaluate equals operator', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.oneof(fc.string(), fc.integer(), fc.boolean()),
        fc.oneof(fc.string(), fc.integer(), fc.boolean()),
        async (
          configKeyId: string,
          keyName: string,
          matchingValue: any,
          nonMatchingValue: any,
        ) => {
          // Ensure values are different
          if (matchingValue === nonMatchingValue) {
            return;
          }

          const defaultValue = 'default';

          // Test matching case
          const matchingRule: Rule = {
            id: 'rule-1',
            config_key_id: configKeyId,
            priority: 100,
            conditions: [
              {
                attribute: 'custom_attributes.test_attr',
                operator: 'equals',
                value: matchingValue,
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

          (mockRuleRepository.findEnabledByConfigKey as jest.Mock).mockResolvedValue([matchingRule]);
          (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfigKey);

          // Context with matching value
          const matchingContext: Context = {
            custom_attributes: {
              test_attr: matchingValue,
            },
          };

          const matchResult = await ruleEngineService.evaluate(configKeyId, matchingContext);
          expect(matchResult).toBe('matched');

          // Context with non-matching value
          const nonMatchingContext: Context = {
            custom_attributes: {
              test_attr: nonMatchingValue,
            },
          };

          const noMatchResult = await ruleEngineService.evaluate(configKeyId, nonMatchingContext);
          expect(noMatchResult).toBe(defaultValue);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 14.2: not_equals operator works correctly
   * 
   * For any value V, a rule with operator 'not_equals' and value V should match
   * when context contains any value other than V, and not match when context contains V.
   */
  it('should correctly evaluate not_equals operator', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.oneof(fc.string(), fc.integer(), fc.boolean()),
        fc.oneof(fc.string(), fc.integer(), fc.boolean()),
        async (
          configKeyId: string,
          keyName: string,
          excludedValue: any,
          differentValue: any,
        ) => {
          // Ensure values are different
          if (excludedValue === differentValue) {
            return;
          }

          const defaultValue = 'default';

          const rule: Rule = {
            id: 'rule-1',
            config_key_id: configKeyId,
            priority: 100,
            conditions: [
              {
                attribute: 'custom_attributes.test_attr',
                operator: 'not_equals',
                value: excludedValue,
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

          // Context with different value should match
          const matchingContext: Context = {
            custom_attributes: {
              test_attr: differentValue,
            },
          };

          const matchResult = await ruleEngineService.evaluate(configKeyId, matchingContext);
          expect(matchResult).toBe('matched');

          // Context with excluded value should not match
          const nonMatchingContext: Context = {
            custom_attributes: {
              test_attr: excludedValue,
            },
          };

          const noMatchResult = await ruleEngineService.evaluate(configKeyId, nonMatchingContext);
          expect(noMatchResult).toBe(defaultValue);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 14.3: in_list operator works correctly
   * 
   * For any list L and value V, a rule with operator 'in_list' and value L should match
   * when context contains a value that is in L, and not match when context contains
   * a value not in L.
   */
  it('should correctly evaluate in_list operator', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.array(fc.string(), { minLength: 1, maxLength: 10 }),
        fc.string(),
        async (
          configKeyId: string,
          keyName: string,
          allowedValues: string[],
          outsideValue: string,
        ) => {
          // Ensure outsideValue is not in the list
          if (allowedValues.includes(outsideValue)) {
            return;
          }

          const defaultValue = 'default';

          const rule: Rule = {
            id: 'rule-1',
            config_key_id: configKeyId,
            priority: 100,
            conditions: [
              {
                attribute: 'custom_attributes.test_attr',
                operator: 'in_list',
                value: allowedValues,
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

          // Test with value in list
          const valueInList = allowedValues[0];
          const matchingContext: Context = {
            custom_attributes: {
              test_attr: valueInList,
            },
          };

          const matchResult = await ruleEngineService.evaluate(configKeyId, matchingContext);
          expect(matchResult).toBe('matched');

          // Test with value not in list
          const nonMatchingContext: Context = {
            custom_attributes: {
              test_attr: outsideValue,
            },
          };

          const noMatchResult = await ruleEngineService.evaluate(configKeyId, nonMatchingContext);
          expect(noMatchResult).toBe(defaultValue);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 14.4: not_in_list operator works correctly
   * 
   * For any list L and value V, a rule with operator 'not_in_list' and value L should match
   * when context contains a value not in L, and not match when context contains a value in L.
   */
  it('should correctly evaluate not_in_list operator', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.array(fc.string(), { minLength: 1, maxLength: 10 }),
        fc.string(),
        async (
          configKeyId: string,
          keyName: string,
          excludedValues: string[],
          allowedValue: string,
        ) => {
          // Ensure allowedValue is not in the excluded list
          if (excludedValues.includes(allowedValue)) {
            return;
          }

          const defaultValue = 'default';

          const rule: Rule = {
            id: 'rule-1',
            config_key_id: configKeyId,
            priority: 100,
            conditions: [
              {
                attribute: 'custom_attributes.test_attr',
                operator: 'not_in_list',
                value: excludedValues,
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

          // Test with value not in excluded list (should match)
          const matchingContext: Context = {
            custom_attributes: {
              test_attr: allowedValue,
            },
          };

          const matchResult = await ruleEngineService.evaluate(configKeyId, matchingContext);
          expect(matchResult).toBe('matched');

          // Test with value in excluded list (should not match)
          const excludedValue = excludedValues[0];
          const nonMatchingContext: Context = {
            custom_attributes: {
              test_attr: excludedValue,
            },
          };

          const noMatchResult = await ruleEngineService.evaluate(configKeyId, nonMatchingContext);
          expect(noMatchResult).toBe(defaultValue);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 14.5: greater_than operator works correctly
   * 
   * For any comparable value V, a rule with operator 'greater_than' and value V should match
   * when context contains a value > V, and not match when context contains a value <= V.
   */
  it('should correctly evaluate greater_than operator', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.integer({ min: 0, max: 1000 }),
        async (
          configKeyId: string,
          keyName: string,
          threshold: number,
        ) => {
          const defaultValue = 'default';

          const rule: Rule = {
            id: 'rule-1',
            config_key_id: configKeyId,
            priority: 100,
            conditions: [
              {
                attribute: 'custom_attributes.test_attr',
                operator: 'greater_than',
                value: threshold,
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

          // Test with value greater than threshold (should match)
          const greaterContext: Context = {
            custom_attributes: {
              test_attr: threshold + 1,
            },
          };

          const matchResult = await ruleEngineService.evaluate(configKeyId, greaterContext);
          expect(matchResult).toBe('matched');

          // Test with value equal to threshold (should not match)
          const equalContext: Context = {
            custom_attributes: {
              test_attr: threshold,
            },
          };

          const equalResult = await ruleEngineService.evaluate(configKeyId, equalContext);
          expect(equalResult).toBe(defaultValue);

          // Test with value less than threshold (should not match)
          if (threshold > 0) {
            const lessContext: Context = {
              custom_attributes: {
                test_attr: threshold - 1,
              },
            };

            const lessResult = await ruleEngineService.evaluate(configKeyId, lessContext);
            expect(lessResult).toBe(defaultValue);
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
   * Property 14.6: less_than operator works correctly
   * 
   * For any comparable value V, a rule with operator 'less_than' and value V should match
   * when context contains a value < V, and not match when context contains a value >= V.
   */
  it('should correctly evaluate less_than operator', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.integer({ min: 1, max: 1000 }),
        async (
          configKeyId: string,
          keyName: string,
          threshold: number,
        ) => {
          const defaultValue = 'default';

          const rule: Rule = {
            id: 'rule-1',
            config_key_id: configKeyId,
            priority: 100,
            conditions: [
              {
                attribute: 'custom_attributes.test_attr',
                operator: 'less_than',
                value: threshold,
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

          // Test with value less than threshold (should match)
          const lessContext: Context = {
            custom_attributes: {
              test_attr: threshold - 1,
            },
          };

          const matchResult = await ruleEngineService.evaluate(configKeyId, lessContext);
          expect(matchResult).toBe('matched');

          // Test with value equal to threshold (should not match)
          const equalContext: Context = {
            custom_attributes: {
              test_attr: threshold,
            },
          };

          const equalResult = await ruleEngineService.evaluate(configKeyId, equalContext);
          expect(equalResult).toBe(defaultValue);

          // Test with value greater than threshold (should not match)
          const greaterContext: Context = {
            custom_attributes: {
              test_attr: threshold + 1,
            },
          };

          const greaterResult = await ruleEngineService.evaluate(configKeyId, greaterContext);
          expect(greaterResult).toBe(defaultValue);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 14.7: regex_match operator works correctly
   * 
   * For any regex pattern P, a rule with operator 'regex_match' and value P should match
   * when context contains a string that matches P, and not match when context contains
   * a string that doesn't match P.
   */
  it('should correctly evaluate regex_match operator', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.constantFrom(
          { pattern: '^test.*', matching: 'test123', nonMatching: 'prod123' },
          { pattern: '.*@example\\.com$', matching: 'user@example.com', nonMatching: 'user@other.com' },
          { pattern: '^v\\d+\\.\\d+\\.\\d+$', matching: 'v1.2.3', nonMatching: 'v1.2' },
          { pattern: '^[A-Z]{2}-\\d{4}$', matching: 'US-1234', nonMatching: 'US-12' },
          { pattern: '^(prod|staging)$', matching: 'prod', nonMatching: 'development' },
        ),
        async (
          configKeyId: string,
          keyName: string,
          testCase: { pattern: string; matching: string; nonMatching: string },
        ) => {
          const defaultValue = 'default';

          const rule: Rule = {
            id: 'rule-1',
            config_key_id: configKeyId,
            priority: 100,
            conditions: [
              {
                attribute: 'custom_attributes.test_attr',
                operator: 'regex_match',
                value: testCase.pattern,
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

          // Test with matching string
          const matchingContext: Context = {
            custom_attributes: {
              test_attr: testCase.matching,
            },
          };

          const matchResult = await ruleEngineService.evaluate(configKeyId, matchingContext);
          expect(matchResult).toBe('matched');

          // Test with non-matching string
          const nonMatchingContext: Context = {
            custom_attributes: {
              test_attr: testCase.nonMatching,
            },
          };

          const noMatchResult = await ruleEngineService.evaluate(configKeyId, nonMatchingContext);
          expect(noMatchResult).toBe(defaultValue);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 14.8: All operators work with multiple rules
   * 
   * Tests that all operators work correctly when multiple rules with different
   * operators are evaluated together. Each test case isolates a single operator.
   */
  it('should correctly evaluate all operators in combination', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 255 }),
        fc.string(),
        fc.integer({ min: 0, max: 100 }),
        fc.array(fc.string(), { minLength: 2, maxLength: 5 }),
        async (
          configKeyId: string,
          keyName: string,
          stringValue: string,
          numericValue: number,
          listValues: string[],
        ) => {
          const defaultValue = 'default';

          // Create rules with all different operators
          // Each rule tests a different attribute to avoid interference
          const rules: Rule[] = [
            {
              id: 'rule-equals',
              config_key_id: configKeyId,
              priority: 700,
              conditions: [
                {
                  attribute: 'custom_attributes.string_attr',
                  operator: 'equals',
                  value: stringValue,
                },
              ],
              value: 'equals-matched',
              enabled: true,
              created_at: new Date(),
              updated_at: new Date(),
            } as Rule,
            {
              id: 'rule-not-equals',
              config_key_id: configKeyId,
              priority: 600,
              conditions: [
                {
                  attribute: 'custom_attributes.not_equals_attr',
                  operator: 'not_equals',
                  value: 'excluded-value',
                },
              ],
              value: 'not-equals-matched',
              enabled: true,
              created_at: new Date(),
              updated_at: new Date(),
            } as Rule,
            {
              id: 'rule-in-list',
              config_key_id: configKeyId,
              priority: 500,
              conditions: [
                {
                  attribute: 'custom_attributes.list_attr',
                  operator: 'in_list',
                  value: listValues,
                },
              ],
              value: 'in-list-matched',
              enabled: true,
              created_at: new Date(),
              updated_at: new Date(),
            } as Rule,
            {
              id: 'rule-not-in-list',
              config_key_id: configKeyId,
              priority: 400,
              conditions: [
                {
                  attribute: 'custom_attributes.not_in_list_attr',
                  operator: 'not_in_list',
                  value: ['excluded1', 'excluded2'],
                },
              ],
              value: 'not-in-list-matched',
              enabled: true,
              created_at: new Date(),
              updated_at: new Date(),
            } as Rule,
            {
              id: 'rule-greater-than',
              config_key_id: configKeyId,
              priority: 300,
              conditions: [
                {
                  attribute: 'custom_attributes.numeric_attr',
                  operator: 'greater_than',
                  value: 50,
                },
              ],
              value: 'greater-than-matched',
              enabled: true,
              created_at: new Date(),
              updated_at: new Date(),
            } as Rule,
            {
              id: 'rule-less-than',
              config_key_id: configKeyId,
              priority: 200,
              conditions: [
                {
                  attribute: 'custom_attributes.less_than_attr',
                  operator: 'less_than',
                  value: 50,
                },
              ],
              value: 'less-than-matched',
              enabled: true,
              created_at: new Date(),
              updated_at: new Date(),
            } as Rule,
            {
              id: 'rule-regex',
              config_key_id: configKeyId,
              priority: 100,
              conditions: [
                {
                  attribute: 'custom_attributes.regex_attr',
                  operator: 'regex_match',
                  value: '^test.*',
                },
              ],
              value: 'regex-matched',
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

          // Test equals operator (highest priority)
          const equalsContext: Context = {
            custom_attributes: {
              string_attr: stringValue,
            },
          };
          const equalsResult = await ruleEngineService.evaluate(configKeyId, equalsContext);
          expect(equalsResult).toBe('equals-matched');

          // Test not_equals operator
          const notEqualsContext: Context = {
            custom_attributes: {
              not_equals_attr: 'some-other-value',
            },
          };
          const notEqualsResult = await ruleEngineService.evaluate(configKeyId, notEqualsContext);
          expect(notEqualsResult).toBe('not-equals-matched');

          // Test in_list operator
          // Provide not_equals_attr as 'excluded-value' so not_equals rule doesn't match
          const inListContext: Context = {
            custom_attributes: {
              not_equals_attr: 'excluded-value',
              list_attr: listValues[0],
            },
          };
          const inListResult = await ruleEngineService.evaluate(configKeyId, inListContext);
          expect(inListResult).toBe('in-list-matched');

          // Test not_in_list operator
          const notInListContext: Context = {
            custom_attributes: {
              not_equals_attr: 'excluded-value',
              not_in_list_attr: 'allowed-value',
            },
          };
          const notInListResult = await ruleEngineService.evaluate(configKeyId, notInListContext);
          expect(notInListResult).toBe('not-in-list-matched');

          // Test greater_than operator
          // Provide values for all higher priority rules so they don't match
          const greaterContext: Context = {
            custom_attributes: {
              not_equals_attr: 'excluded-value', // Won't match not_equals
              not_in_list_attr: 'excluded1', // Won't match not_in_list (it's IN the excluded list)
              numeric_attr: numericValue > 50 ? numericValue : 51,
            },
          };
          const greaterResult = await ruleEngineService.evaluate(configKeyId, greaterContext);
          expect(greaterResult).toBe('greater-than-matched');

          // Test less_than operator
          const lessContext: Context = {
            custom_attributes: {
              not_equals_attr: 'excluded-value',
              not_in_list_attr: 'excluded1',
              less_than_attr: numericValue < 50 ? numericValue : 49,
            },
          };
          const lessResult = await ruleEngineService.evaluate(configKeyId, lessContext);
          expect(lessResult).toBe('less-than-matched');

          // Test regex operator
          const regexContext: Context = {
            custom_attributes: {
              not_equals_attr: 'excluded-value',
              not_in_list_attr: 'excluded1',
              regex_attr: 'test123',
            },
          };
          const regexResult = await ruleEngineService.evaluate(configKeyId, regexContext);
          expect(regexResult).toBe('regex-matched');

          // Test default fallback when no rules match
          // Provide values that don't match any rules
          const noMatchContext: Context = {
            custom_attributes: {
              not_equals_attr: 'excluded-value', // Won't match not_equals
              not_in_list_attr: 'excluded1', // Won't match not_in_list
              unrelated_attr: 'value', // No rules check this
            },
          };
          const defaultResult = await ruleEngineService.evaluate(configKeyId, noMatchContext);
          expect(defaultResult).toBe(defaultValue);
        },
      ),
      {
        numRuns: 50,
        verbose: true,
      },
    );
  });
});
