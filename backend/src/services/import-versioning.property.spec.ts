import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from './config.service';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { ConfigVersionRepository } from '../repositories/config-version.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { RuleRepository } from '../repositories/rule.repository';
import { ValidationService } from './validation.service';
import * as fc from 'fast-check';

/**
 * Property 58: Import creates new versions for existing configs
 * **Validates: Requirements 17.4**
 * 
 * For any import containing config key K that already exists, after import completes,
 * a new config_version should exist for K with the imported value.
 */
describe('Property 58: Import versioning', () => {
  let service: ConfigService;
  let configKeyRepository: jest.Mocked<ConfigKeyRepository>;
  let ruleRepository: jest.Mocked<RuleRepository>;
  let mockTransactionCallback: any;

  beforeEach(async () => {
    const mockConfigKeyRepository = {
      findByKey: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      repository: {
        manager: {
          transaction: jest.fn((callback) => {
            // Create a fresh transaction manager for each call
            const transactionManager = {
              update: jest.fn(),
              create: jest.fn((entity, data) => ({ ...data, id: data.config_key_id || 'new-id' })),
              save: jest.fn((entity, data) => data || entity),
              remove: jest.fn(),
            };
            mockTransactionCallback = transactionManager;
            return callback(transactionManager);
          }),
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

  it('should create new version when importing existing config', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          organizationId: fc.uuid(),
          projectId: fc.uuid(),
          environmentId: fc.uuid(),
          configId: fc.uuid(),
          keyName: fc.string({ minLength: 1, maxLength: 50 }),
          importedBy: fc.uuid(),
        }).chain(({ organizationId, projectId, environmentId, configId, keyName, importedBy }) =>
          fc.constantFrom('boolean', 'string', 'number').chain(valueType => {
            const valueGen = valueType === 'boolean' ? fc.boolean() :
                            valueType === 'string' ? fc.string() :
                            fc.integer();
            
            return fc.tuple(valueGen, valueGen).map(([oldValue, newValue]) => ({
              organizationId,
              projectId,
              environmentId,
              configId,
              keyName,
              valueType,
              oldValue,
              newValue,
              importedBy,
            }));
          })
        ),
        async ({ organizationId, projectId, environmentId, configId, keyName, valueType, oldValue, newValue, importedBy }) => {
          // Setup: Config already exists
          const existingConfig = {
            id: configId,
            organization_id: organizationId,
            project_id: projectId,
            environment_id: environmentId,
            key_name: keyName,
            value_type: valueType,
            current_value: oldValue,
            schema: undefined,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
          };

          configKeyRepository.findByKey.mockResolvedValue(existingConfig as any);
          ruleRepository.findByConfigKey.mockResolvedValue([]);

          const exportData: any = {
            version: '1.0',
            exportedAt: new Date(),
            organizationId,
            projectId,
            environmentId,
            configs: [{
              keyName,
              valueType,
              currentValue: newValue,
              schema: undefined,
              rules: [],
            }],
          };

          // Execute: Import
          await service.importConfigs(exportData, importedBy);

          // Verify: New version was created for the existing config
          const allCreateCalls = mockTransactionCallback.create.mock.calls;
          const configVersionCalls = allCreateCalls.filter(
            (call: any) => call[0].name === 'ConfigVersion'
          );
          
          // Should have exactly one version created (for the update)
          expect(configVersionCalls.length).toBe(1);
          
          // Verify the version has the correct data
          const versionData = configVersionCalls[0][1];
          expect(versionData.config_key_id).toBe(configId);
          expect(versionData.value).toEqual(newValue);
          expect(versionData.created_by).toBe(importedBy);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not create version when importing new config', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          organizationId: fc.uuid(),
          projectId: fc.uuid(),
          environmentId: fc.uuid(),
          keyName: fc.string({ minLength: 1, maxLength: 50 }),
          importedBy: fc.uuid(),
        }).chain(({ organizationId, projectId, environmentId, keyName, importedBy }) =>
          fc.constantFrom('boolean', 'string', 'number').chain(valueType => {
            const valueGen = valueType === 'boolean' ? fc.boolean() :
                            valueType === 'string' ? fc.string() :
                            fc.integer();
            
            return valueGen.map(value => ({
              organizationId,
              projectId,
              environmentId,
              keyName,
              valueType,
              value,
              importedBy,
            }));
          })
        ),
        async ({ organizationId, projectId, environmentId, keyName, valueType, value, importedBy }) => {
          // Setup: Config doesn't exist
          configKeyRepository.findByKey.mockResolvedValue(null);
          ruleRepository.findByConfigKey.mockResolvedValue([]);

          const exportData: any = {
            version: '1.0',
            exportedAt: new Date(),
            organizationId,
            projectId,
            environmentId,
            configs: [{
              keyName,
              valueType,
              currentValue: value,
              schema: undefined,
              rules: [],
            }],
          };

          // Execute: Import
          await service.importConfigs(exportData, importedBy);

          // Verify: Version was created for the new config
          const configVersionCalls = mockTransactionCallback.create.mock.calls.filter(
            (call: any) => call[0].name === 'ConfigVersion'
          );
          
          expect(configVersionCalls.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
