import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from './config.service';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { ConfigVersionRepository } from '../repositories/config-version.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { RuleRepository } from '../repositories/rule.repository';
import { ValidationService } from './validation.service';
import * as fc from 'fast-check';

/**
 * Property 55: Export includes all config data
 * **Validates: Requirements 17.1**
 * 
 * For any export request for project P and environment E, the resulting JSON
 * should contain all config keys, their current values, and all associated rules
 * for that project and environment.
 */
describe('Property 55: Export completeness', () => {
  let service: ConfigService;
  let configKeyRepository: jest.Mocked<ConfigKeyRepository>;
  let ruleRepository: jest.Mocked<RuleRepository>;

  beforeEach(async () => {
    const mockConfigKeyRepository = {
      findByEnvironment: jest.fn(),
    };

    const mockConfigVersionRepository = {
      create: jest.fn(),
      findByConfigKey: jest.fn(),
    };

    const mockAuditLogRepository = {
      create: jest.fn(),
    };

    const mockRuleRepository = {
      findByConfigKey: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn(),
      invalidateConfig: jest.fn(),
    };

    const mockValidationService = {
      validate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigService,
        { provide: ConfigKeyRepository, useValue: mockConfigKeyRepository },
        { provide: ConfigVersionRepository, useValue: mockConfigVersionRepository },
        { provide: AuditLogRepository, useValue: mockAuditLogRepository },
        { provide: RuleRepository, useValue: mockRuleRepository },
        { provide: 'CacheService', useValue: mockCacheService },
        { provide: ValidationService, useValue: mockValidationService },
      ],
    }).compile();

    service = module.get<ConfigService>(ConfigService);
    configKeyRepository = module.get(ConfigKeyRepository);
    ruleRepository = module.get(RuleRepository);
  });

  it('should include all configs and their rules in export', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          organizationId: fc.uuid(),
          projectId: fc.uuid(),
          environmentId: fc.uuid(),
          configs: fc.array(
            fc.record({
              id: fc.uuid(),
              key_name: fc.string({ minLength: 1, maxLength: 50 }),
              value_type: fc.constantFrom('boolean', 'string', 'number', 'json'),
              current_value: fc.oneof(
                fc.boolean(),
                fc.string(),
                fc.integer(),
                fc.jsonValue()
              ),
              schema: fc.option(fc.object(), { nil: undefined }),
              rules: fc.array(
                fc.record({
                  id: fc.uuid(),
                  priority: fc.integer({ min: 0, max: 1000 }),
                  conditions: fc.array(fc.object()),
                  value: fc.oneof(
                    fc.boolean(),
                    fc.string(),
                    fc.integer(),
                    fc.jsonValue()
                  ),
                  enabled: fc.boolean(),
                }),
                { maxLength: 5 }
              ),
            }),
            { minLength: 1, maxLength: 10 }
          ),
        }),
        async ({ organizationId, projectId, environmentId, configs }) => {
          // Setup: Mock repository to return the configs
          configKeyRepository.findByEnvironment.mockResolvedValue(
            configs.map(c => ({
              id: c.id,
              organization_id: organizationId,
              project_id: projectId,
              environment_id: environmentId,
              key_name: c.key_name,
              value_type: c.value_type,
              current_value: c.current_value,
              schema: c.schema,
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            })) as any
          );

          // Mock rules for each config
          for (const config of configs) {
            ruleRepository.findByConfigKey.mockResolvedValueOnce(
              config.rules.map(r => ({
                id: r.id,
                config_key_id: config.id,
                priority: r.priority,
                conditions: r.conditions,
                value: r.value,
                enabled: r.enabled,
                created_at: new Date(),
                updated_at: new Date(),
              })) as any
            );
          }

          // Execute: Export configs
          const result = await service.exportConfigs(
            organizationId,
            projectId,
            environmentId
          );

          // Verify: All configs are included
          expect(result.configs).toHaveLength(configs.length);
          expect(result.organizationId).toBe(organizationId);
          expect(result.projectId).toBe(projectId);
          expect(result.environmentId).toBe(environmentId);

          // Verify: Each config has correct data
          for (let i = 0; i < configs.length; i++) {
            const expectedConfig = configs[i];
            const exportedConfig = result.configs[i];

            expect(exportedConfig.keyName).toBe(expectedConfig.key_name);
            expect(exportedConfig.valueType).toBe(expectedConfig.value_type);
            expect(exportedConfig.currentValue).toEqual(expectedConfig.current_value);
            expect(exportedConfig.schema).toEqual(expectedConfig.schema);

            // Verify: All rules are included
            expect(exportedConfig.rules).toHaveLength(expectedConfig.rules.length);
            
            for (let j = 0; j < expectedConfig.rules.length; j++) {
              const expectedRule = expectedConfig.rules[j];
              const exportedRule = exportedConfig.rules[j];

              expect(exportedRule.priority).toBe(expectedRule.priority);
              expect(exportedRule.conditions).toEqual(expectedRule.conditions);
              expect(exportedRule.value).toEqual(expectedRule.value);
              expect(exportedRule.enabled).toBe(expectedRule.enabled);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
