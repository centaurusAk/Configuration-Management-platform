import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from './config.service';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { ConfigVersionRepository } from '../repositories/config-version.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { RuleRepository } from '../repositories/rule.repository';
import { ValidationService } from './validation.service';
import * as fc from 'fast-check';

/**
 * Property 56: Import creates or updates configs
 * **Validates: Requirements 17.2**
 * 
 * For any valid import JSON containing config C, after import completes,
 * config C should exist in the database with the value from the import.
 */
describe('Property 56: Import creates or updates configs', () => {
  let service: ConfigService;
  let configKeyRepository: jest.Mocked<ConfigKeyRepository>;
  let configVersionRepository: jest.Mocked<ConfigVersionRepository>;
  let auditLogRepository: jest.Mocked<AuditLogRepository>;
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
    configVersionRepository = module.get(ConfigVersionRepository);
    auditLogRepository = module.get(AuditLogRepository);
    ruleRepository = module.get(RuleRepository);
  });

  it('should create new configs from import', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          organizationId: fc.uuid(),
          projectId: fc.uuid(),
          environmentId: fc.uuid(),
          importedBy: fc.uuid(),
        }).chain(({ organizationId, projectId, environmentId, importedBy }) =>
          fc.constantFrom('boolean', 'string', 'number', 'json').chain(valueType => {
            const valueGen = valueType === 'boolean' ? fc.boolean() :
                            valueType === 'string' ? fc.string() :
                            valueType === 'number' ? fc.integer() :
                            fc.oneof(fc.object(), fc.array(fc.anything()));
            
            return fc.record({
              organizationId: fc.constant(organizationId),
              projectId: fc.constant(projectId),
              environmentId: fc.constant(environmentId),
              importedBy: fc.constant(importedBy),
              config: fc.record({
                keyName: fc.string({ minLength: 1, maxLength: 50 }),
                valueType: fc.constant(valueType),
                currentValue: valueGen,
                schema: fc.option(fc.object(), { nil: undefined }),
                rules: fc.array(
                  fc.record({
                    priority: fc.integer({ min: 0, max: 1000 }),
                    conditions: fc.array(fc.object()),
                    value: valueGen,
                    enabled: fc.boolean(),
                  }),
                  { maxLength: 3 }
                ),
              }),
            });
          })
        ),
        async ({ organizationId, projectId, environmentId, config, importedBy }) => {
          // Setup: Config doesn't exist yet
          configKeyRepository.findByKey.mockResolvedValue(null);
          ruleRepository.findByConfigKey.mockResolvedValue([]);

          const exportData: any = {
            version: '1.0',
            exportedAt: new Date(),
            organizationId,
            projectId,
            environmentId,
            configs: [config],
          };

          // Execute: Import
          const result = await service.importConfigs(exportData, importedBy);

          // Verify: Config was created
          expect(result.created).toBe(1);
          expect(result.updated).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should update existing configs from import', async () => {
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
          const result = await service.importConfigs(exportData, importedBy);

          // Verify: Config was updated
          expect(result.created).toBe(0);
          expect(result.updated).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
