import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from './config.service';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { ConfigVersionRepository } from '../repositories/config-version.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { RuleRepository } from '../repositories/rule.repository';
import { ValidationService } from './validation.service';
import * as fc from 'fast-check';

/**
 * Property 57: Import validates before applying
 * **Validates: Requirements 17.3**
 * 
 * For any import JSON containing at least one invalid config value,
 * the entire import should fail and zero configs should be created or updated.
 */
describe('Property 57: Import validation', () => {
  let service: ConfigService;
  let configKeyRepository: jest.Mocked<ConfigKeyRepository>;
  let ruleRepository: jest.Mocked<RuleRepository>;

  beforeEach(async () => {
    const mockConfigKeyRepository = {
      findByKey: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      repository: {
        manager: {
          transaction: jest.fn((callback) => callback({
            update: jest.fn(),
            create: jest.fn((entity, data) => data),
            save: jest.fn((entity, data) => data || entity),
            remove: jest.fn(),
          })),
        },
      },
    };

    const mockConfigVersionRepository = {
      create: jest.fn(),
    };

    const mockAuditLogRepository = {
      create: jest.fn(),
    };

    const mockRuleRepository = {
      findByConfigKey: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn(),
      invalidateConfig: jest.fn(),
    };

    const mockValidationService = {
      validate: jest.fn(),
      validateAgainstSchema: jest.fn(),
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

  it('should reject entire import if any config has invalid value type', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          organizationId: fc.uuid(),
          projectId: fc.uuid(),
          environmentId: fc.uuid(),
          importedBy: fc.uuid(),
          validConfig: fc.record({
            keyName: fc.string({ minLength: 1, maxLength: 50 }),
            valueType: fc.constant('boolean' as const),
            currentValue: fc.boolean(),
            rules: fc.constant([]),
          }),
          invalidConfig: fc.record({
            keyName: fc.string({ minLength: 1, maxLength: 50 }),
            valueType: fc.constant('boolean' as const),
            currentValue: fc.string(), // Wrong type - should be boolean
            rules: fc.constant([]),
          }),
        }),
        async ({ organizationId, projectId, environmentId, importedBy, validConfig, invalidConfig }) => {
          // Setup: No configs exist
          configKeyRepository.findByKey.mockResolvedValue(null);
          ruleRepository.findByConfigKey.mockResolvedValue([]);

          const exportData: any = {
            version: '1.0',
            exportedAt: new Date(),
            organizationId,
            projectId,
            environmentId,
            configs: [validConfig, invalidConfig],
          };

          // Execute: Import should fail
          await expect(service.importConfigs(exportData, importedBy)).rejects.toThrow();

          // Verify: Transaction was never called (validation failed before transaction)
          // The repository methods should not have been called
          expect(configKeyRepository['repository'].manager.transaction).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject entire import if any rule value has invalid type', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          organizationId: fc.uuid(),
          projectId: fc.uuid(),
          environmentId: fc.uuid(),
          importedBy: fc.uuid(),
          configWithInvalidRule: fc.record({
            keyName: fc.string({ minLength: 1, maxLength: 50 }),
            valueType: fc.constant('number' as const),
            currentValue: fc.integer(),
            rules: fc.constant([{
              priority: 1,
              conditions: [],
              value: 'invalid', // Wrong type - should be number
              enabled: true,
            }]),
          }),
        }),
        async ({ organizationId, projectId, environmentId, importedBy, configWithInvalidRule }) => {
          // Setup: No configs exist
          configKeyRepository.findByKey.mockResolvedValue(null);
          ruleRepository.findByConfigKey.mockResolvedValue([]);

          const exportData: any = {
            version: '1.0',
            exportedAt: new Date(),
            organizationId,
            projectId,
            environmentId,
            configs: [configWithInvalidRule],
          };

          // Execute: Import should fail
          await expect(service.importConfigs(exportData, importedBy)).rejects.toThrow();

          // Verify: Transaction was never called
          expect(configKeyRepository['repository'].manager.transaction).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});
