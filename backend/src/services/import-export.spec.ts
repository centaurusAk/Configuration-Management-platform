import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from './config.service';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { ConfigVersionRepository } from '../repositories/config-version.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { RuleRepository } from '../repositories/rule.repository';
import { ValidationService } from './validation.service';

/**
 * Unit tests for import/export functionality
 * Requirements: 17.1, 17.4, 17.6
 */
describe('Import/Export Unit Tests', () => {
  let service: ConfigService;
  let configKeyRepository: jest.Mocked<ConfigKeyRepository>;
  let ruleRepository: jest.Mocked<RuleRepository>;
  let mockTransactionCallback: any;

  beforeEach(async () => {
    const mockConfigKeyRepository = {
      findByEnvironment: jest.fn(),
      findByKey: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      repository: {
        manager: {
          transaction: jest.fn((callback) => {
            mockTransactionCallback = {
              update: jest.fn(),
              create: jest.fn((entity, data) => ({ ...data, id: 'new-id' })),
              save: jest.fn((entity, data) => data || entity),
              remove: jest.fn(),
            };
            return callback(mockTransactionCallback);
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

  describe('exportConfigs', () => {
    it('should export configs with correct format (Requirement 17.1)', async () => {
      const orgId = 'org-1';
      const projId = 'proj-1';
      const envId = 'env-1';

      const mockConfigs = [
        {
          id: 'config-1',
          key_name: 'feature_flag',
          value_type: 'boolean',
          current_value: true,
          schema: undefined,
        },
      ];

      const mockRules = [
        {
          priority: 100,
          conditions: [{ attribute: 'tier', operator: 'equals', value: 'premium' }],
          value: false,
          enabled: true,
        },
      ];

      configKeyRepository.findByEnvironment.mockResolvedValue(mockConfigs as any);
      ruleRepository.findByConfigKey.mockResolvedValue(mockRules as any);

      const result = await service.exportConfigs(orgId, projId, envId);

      expect(result.version).toBe('1.0');
      expect(result.organizationId).toBe(orgId);
      expect(result.projectId).toBe(projId);
      expect(result.environmentId).toBe(envId);
      expect(result.configs).toHaveLength(1);
      expect(result.configs[0].keyName).toBe('feature_flag');
      expect(result.configs[0].rules).toHaveLength(1);
      expect(result.configs[0].rules[0].priority).toBe(100);
    });

    it('should export empty array when no configs exist', async () => {
      configKeyRepository.findByEnvironment.mockResolvedValue([]);

      const result = await service.exportConfigs('org-1', 'proj-1', 'env-1');

      expect(result.configs).toEqual([]);
    });
  });

  describe('importConfigs', () => {
    it('should import with existing and new configs (Requirement 17.2)', async () => {
      const existingConfig = {
        id: 'existing-1',
        key_name: 'existing_key',
        value_type: 'string',
        current_value: 'old',
      };

      configKeyRepository.findByKey
        .mockResolvedValueOnce(existingConfig as any) // First config exists
        .mockResolvedValueOnce(null); // Second config is new

      ruleRepository.findByConfigKey.mockResolvedValue([]);

      const exportData: any = {
        version: '1.0',
        exportedAt: new Date(),
        organizationId: 'org-1',
        projectId: 'proj-1',
        environmentId: 'env-1',
        configs: [
          {
            keyName: 'existing_key',
            valueType: 'string',
            currentValue: 'new',
            rules: [],
          },
          {
            keyName: 'new_key',
            valueType: 'boolean',
            currentValue: true,
            rules: [],
          },
        ],
      };

      const result = await service.importConfigs(exportData, 'user-1');

      expect(result.created).toBe(1);
      expect(result.updated).toBe(1);
    });

    it('should preserve rule priorities during import (Requirement 17.6)', async () => {
      configKeyRepository.findByKey.mockResolvedValue(null);
      ruleRepository.findByConfigKey.mockResolvedValue([]);

      const exportData: any = {
        version: '1.0',
        exportedAt: new Date(),
        organizationId: 'org-1',
        projectId: 'proj-1',
        environmentId: 'env-1',
        configs: [
          {
            keyName: 'test_key',
            valueType: 'string',
            currentValue: 'value',
            rules: [
              { priority: 100, conditions: [], value: 'high', enabled: true },
              { priority: 50, conditions: [], value: 'medium', enabled: true },
              { priority: 10, conditions: [], value: 'low', enabled: true },
            ],
          },
        ],
      };

      await service.importConfigs(exportData, 'user-1');

      // Verify rules were created with correct priorities
      const ruleCalls = mockTransactionCallback.create.mock.calls.filter(
        (call: any) => call[0].name === 'Rule'
      );

      expect(ruleCalls).toHaveLength(3);
      expect(ruleCalls[0][1].priority).toBe(100);
      expect(ruleCalls[1][1].priority).toBe(50);
      expect(ruleCalls[2][1].priority).toBe(10);
    });

    it('should create new version for existing config (Requirement 17.4)', async () => {
      const existingConfig = {
        id: 'config-1',
        key_name: 'test_key',
        value_type: 'number',
        current_value: 10,
      };

      configKeyRepository.findByKey.mockResolvedValue(existingConfig as any);
      ruleRepository.findByConfigKey.mockResolvedValue([]);

      const exportData: any = {
        version: '1.0',
        exportedAt: new Date(),
        organizationId: 'org-1',
        projectId: 'proj-1',
        environmentId: 'env-1',
        configs: [
          {
            keyName: 'test_key',
            valueType: 'number',
            currentValue: 20,
            rules: [],
          },
        ],
      };

      await service.importConfigs(exportData, 'user-1');

      // Verify version was created
      const versionCalls = mockTransactionCallback.create.mock.calls.filter(
        (call: any) => call[0].name === 'ConfigVersion'
      );

      expect(versionCalls).toHaveLength(1);
      expect(versionCalls[0][1].value).toBe(20);
    });

    it('should replace existing rules during import', async () => {
      const existingConfig = {
        id: 'config-1',
        key_name: 'test_key',
        value_type: 'string',
        current_value: 'value',
      };

      const existingRules = [
        { id: 'rule-1', priority: 50 },
        { id: 'rule-2', priority: 25 },
      ];

      configKeyRepository.findByKey.mockResolvedValue(existingConfig as any);
      ruleRepository.findByConfigKey.mockResolvedValue(existingRules as any);

      const exportData: any = {
        version: '1.0',
        exportedAt: new Date(),
        organizationId: 'org-1',
        projectId: 'proj-1',
        environmentId: 'env-1',
        configs: [
          {
            keyName: 'test_key',
            valueType: 'string',
            currentValue: 'value',
            rules: [
              { priority: 100, conditions: [], value: 'new', enabled: true },
            ],
          },
        ],
      };

      await service.importConfigs(exportData, 'user-1');

      // Verify old rules were removed
      expect(mockTransactionCallback.remove).toHaveBeenCalledTimes(2);

      // Verify new rule was created
      const ruleCalls = mockTransactionCallback.create.mock.calls.filter(
        (call: any) => call[0].name === 'Rule'
      );
      expect(ruleCalls).toHaveLength(1);
      expect(ruleCalls[0][1].priority).toBe(100);
    });
  });
});
