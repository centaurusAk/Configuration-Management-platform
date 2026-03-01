import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { ConfigVersionRepository } from '../repositories/config-version.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { RuleRepository } from '../repositories/rule.repository';
import { CacheService } from './cache.service';
import { ValidationService } from './validation.service';

/**
 * Unit Tests for ConfigService
 * 
 * Tests config creation with different value types, soft delete behavior,
 * and version ordering.
 * 
 * Requirements: 1.3, 1.6, 2.2
 */
describe('ConfigService', () => {
  let service: ConfigService;
  let mockConfigKeyRepository: any;
  let mockConfigVersionRepository: any;
  let mockAuditLogRepository: any;
  let mockRuleRepository: any;
  let mockCacheService: any;

  beforeEach(async () => {
    mockConfigKeyRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      findByKey: jest.fn(),
      findByEnvironment: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    mockConfigVersionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findByConfigKey: jest.fn(),
      countByConfigKey: jest.fn(),
    };

    mockAuditLogRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    mockRuleRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByConfigKey: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidate: jest.fn().mockResolvedValue(undefined),
      invalidateConfig: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigService,
        ValidationService,
        {
          provide: ConfigKeyRepository,
          useValue: mockConfigKeyRepository,
        },
        {
          provide: ConfigVersionRepository,
          useValue: mockConfigVersionRepository,
        },
        {
          provide: AuditLogRepository,
          useValue: mockAuditLogRepository,
        },
        {
          provide: RuleRepository,
          useValue: mockRuleRepository,
        },
        {
          provide: 'CacheService',
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<ConfigService>(ConfigService);
  });

  describe('create', () => {
    /**
     * Requirement 1.3: Support boolean, string, number, and JSON value types
     */
    it('should create config with boolean value', async () => {
      const mockConfig = {
        id: 'config-1',
        organization_id: 'org-1',
        project_id: 'proj-1',
        environment_id: 'env-1',
        key_name: 'feature.enabled',
        value_type: 'boolean',
        current_value: true,
      };

      const mockVersion = {
        id: 'version-1',
        config_key_id: 'config-1',
        value: true,
        created_by: 'user-1',
      };

      (mockConfigKeyRepository.create as jest.Mock).mockResolvedValue(mockConfig);
      (mockConfigVersionRepository.create as jest.Mock).mockResolvedValue(mockVersion);
      (mockAuditLogRepository.create as jest.Mock).mockResolvedValue({});

      const result = await service.create({
        organizationId: 'org-1',
        projectId: 'proj-1',
        environmentId: 'env-1',
        keyName: 'feature.enabled',
        valueType: 'boolean',
        defaultValue: true,
        createdBy: 'user-1',
      });

      expect(result).toEqual(mockConfig);
      expect(mockConfigKeyRepository.create).toHaveBeenCalledWith(
        'org-1',
        'proj-1',
        'env-1',
        'feature.enabled',
        'boolean',
        true,
        undefined,
      );
      expect(mockConfigVersionRepository.create).toHaveBeenCalledWith(
        'config-1',
        true,
        'user-1',
      );
      expect(mockAuditLogRepository.create).toHaveBeenCalledWith(
        'user-1',
        'org-1',
        'CREATE',
        'CONFIG_KEY',
        'config-1',
        null,
        true,
        {
          key_name: 'feature.enabled',
          value_type: 'boolean',
        },
      );
    });

    it('should create config with string value', async () => {
      const mockConfig = {
        id: 'config-2',
        organization_id: 'org-1',
        project_id: 'proj-1',
        environment_id: 'env-1',
        key_name: 'app.name',
        value_type: 'string',
        current_value: 'test-value',
      };

      (mockConfigKeyRepository.create as jest.Mock).mockResolvedValue(mockConfig);
      (mockConfigVersionRepository.create as jest.Mock).mockResolvedValue({});
      (mockAuditLogRepository.create as jest.Mock).mockResolvedValue({});

      const result = await service.create({
        organizationId: 'org-1',
        projectId: 'proj-1',
        environmentId: 'env-1',
        keyName: 'app.name',
        valueType: 'string',
        defaultValue: 'test-value',
        createdBy: 'user-1',
      });

      expect(result.value_type).toBe('string');
      expect(result.current_value).toBe('test-value');
    });

    it('should create config with number value', async () => {
      const mockConfig = {
        id: 'config-3',
        organization_id: 'org-1',
        project_id: 'proj-1',
        environment_id: 'env-1',
        key_name: 'max.connections',
        value_type: 'number',
        current_value: 42,
      };

      (mockConfigKeyRepository.create as jest.Mock).mockResolvedValue(mockConfig);
      (mockConfigVersionRepository.create as jest.Mock).mockResolvedValue({});
      (mockAuditLogRepository.create as jest.Mock).mockResolvedValue({});

      const result = await service.create({
        organizationId: 'org-1',
        projectId: 'proj-1',
        environmentId: 'env-1',
        keyName: 'max.connections',
        valueType: 'number',
        defaultValue: 42,
        createdBy: 'user-1',
      });

      expect(result.value_type).toBe('number');
      expect(result.current_value).toBe(42);
    });

    it('should create config with JSON value', async () => {
      const jsonValue = { feature: 'enabled', users: ['user1', 'user2'] };
      const mockConfig = {
        id: 'config-4',
        organization_id: 'org-1',
        project_id: 'proj-1',
        environment_id: 'env-1',
        key_name: 'feature.config',
        value_type: 'json',
        current_value: jsonValue,
      };

      (mockConfigKeyRepository.create as jest.Mock).mockResolvedValue(mockConfig);
      (mockConfigVersionRepository.create as jest.Mock).mockResolvedValue({});
      (mockAuditLogRepository.create as jest.Mock).mockResolvedValue({});

      const result = await service.create({
        organizationId: 'org-1',
        projectId: 'proj-1',
        environmentId: 'env-1',
        keyName: 'feature.config',
        valueType: 'json',
        defaultValue: jsonValue,
        createdBy: 'user-1',
      });

      expect(result.value_type).toBe('json');
      expect(result.current_value).toEqual(jsonValue);
    });
  });

  describe('delete', () => {
    /**
     * Requirement 1.6: Soft delete only
     */
    it('should perform soft delete', async () => {
      const mockConfig = {
        id: 'config-1',
        organization_id: 'org-1',
        key_name: 'test.key',
        current_value: 'value',
      };

      (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfig);
      (mockConfigKeyRepository.softDelete as jest.Mock).mockResolvedValue(undefined);
      (mockAuditLogRepository.create as jest.Mock).mockResolvedValue({});

      await service.delete('config-1', 'user-1');

      expect(mockConfigKeyRepository.softDelete).toHaveBeenCalledWith('config-1');
      expect(mockAuditLogRepository.create).toHaveBeenCalledWith(
        'user-1',
        'org-1',
        'DELETE',
        'CONFIG_KEY',
        'config-1',
        'value',
        null,
        expect.objectContaining({
          key_name: 'test.key',
          soft_delete: true,
        }),
      );
    });

    it('should throw NotFoundException if config does not exist', async () => {
      (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.delete('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getVersionHistory', () => {
    /**
     * Requirement 2.2: Return versions in reverse chronological order
     */
    it('should return versions in reverse chronological order', async () => {
      const mockConfig = { id: 'config-1' };
      const mockVersions = [
        {
          id: 'version-3',
          created_at: new Date('2024-01-03'),
          value: 'value3',
        },
        {
          id: 'version-2',
          created_at: new Date('2024-01-02'),
          value: 'value2',
        },
        {
          id: 'version-1',
          created_at: new Date('2024-01-01'),
          value: 'value1',
        },
      ];

      (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfig);
      (mockConfigVersionRepository.findByConfigKey as jest.Mock).mockResolvedValue(
        mockVersions,
      );

      const result = await service.getVersionHistory('config-1');

      expect(result).toEqual(mockVersions);
      expect(result[0].created_at.getTime()).toBeGreaterThan(
        result[1].created_at.getTime(),
      );
      expect(result[1].created_at.getTime()).toBeGreaterThan(
        result[2].created_at.getTime(),
      );
    });

    it('should throw NotFoundException if config does not exist', async () => {
      (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.getVersionHistory('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should validate value type matches config type', async () => {
      const mockConfig = {
        id: 'config-1',
        value_type: 'boolean',
        current_value: true,
      };

      (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfig);

      // Attempt to update with wrong type
      await expect(
        service.update('config-1', {
          value: 'string-value', // Wrong type
          updatedBy: 'user-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create new version on update', async () => {
      const mockConfig = {
        id: 'config-1',
        organization_id: 'org-1',
        key_name: 'test.key',
        value_type: 'string',
        current_value: 'old-value',
      };

      const mockNewVersion = {
        id: 'version-2',
        config_key_id: 'config-1',
        value: 'new-value',
        created_by: 'user-1',
      };

      (mockConfigKeyRepository.findById as jest.Mock).mockResolvedValue(mockConfig);
      (mockConfigKeyRepository.update as jest.Mock).mockResolvedValue(undefined);
      (mockConfigVersionRepository.create as jest.Mock).mockResolvedValue(mockNewVersion);
      (mockAuditLogRepository.create as jest.Mock).mockResolvedValue({});

      const result = await service.update('config-1', {
        value: 'new-value',
        updatedBy: 'user-1',
      });

      expect(result).toEqual(mockNewVersion);
      expect(mockConfigVersionRepository.create).toHaveBeenCalledWith(
        'config-1',
        'new-value',
        'user-1',
      );
      expect(mockAuditLogRepository.create).toHaveBeenCalledWith(
        'user-1',
        'org-1',
        'UPDATE',
        'CONFIG_KEY',
        'config-1',
        'old-value',
        'new-value',
        expect.objectContaining({
          version_id: 'version-2',
          key_name: 'test.key',
        }),
      );
    });
  });

  describe('exportConfigs', () => {
    /**
     * Requirement 17.1: Export JSON with all configs, values, and rules
     * Requirement 17.5: Support filtering by project and environment
     */
    it('should export all configs with their rules for a project/environment', async () => {
      const mockConfigs = [
        {
          id: 'config-1',
          organization_id: 'org-1',
          project_id: 'proj-1',
          environment_id: 'env-1',
          key_name: 'feature.enabled',
          value_type: 'boolean',
          current_value: true,
          schema: null,
        },
        {
          id: 'config-2',
          organization_id: 'org-1',
          project_id: 'proj-1',
          environment_id: 'env-1',
          key_name: 'api.timeout',
          value_type: 'number',
          current_value: 5000,
          schema: { type: 'number', minimum: 0 },
        },
      ];

      const mockRulesConfig1 = [
        {
          id: 'rule-1',
          config_key_id: 'config-1',
          priority: 100,
          conditions: [{ attribute: 'region', operator: 'equals', value: 'us-east' }],
          value: false,
          enabled: true,
        },
      ];

      const mockRulesConfig2 = [
        {
          id: 'rule-2',
          config_key_id: 'config-2',
          priority: 50,
          conditions: [{ attribute: 'tier', operator: 'equals', value: 'premium' }],
          value: 10000,
          enabled: true,
        },
      ];

      (mockConfigKeyRepository.findByEnvironment as jest.Mock).mockResolvedValue(mockConfigs);
      (mockRuleRepository.findByConfigKey as jest.Mock)
        .mockResolvedValueOnce(mockRulesConfig1)
        .mockResolvedValueOnce(mockRulesConfig2);

      const result = await service.exportConfigs('org-1', 'proj-1', 'env-1');

      expect(result).toMatchObject({
        version: '1.0',
        organizationId: 'org-1',
        projectId: 'proj-1',
        environmentId: 'env-1',
      });
      expect(result.exportedAt).toBeInstanceOf(Date);
      expect(result.configs).toHaveLength(2);

      // Verify first config
      expect(result.configs[0]).toEqual({
        keyName: 'feature.enabled',
        valueType: 'boolean',
        currentValue: true,
        schema: null,
        rules: [
          {
            priority: 100,
            conditions: [{ attribute: 'region', operator: 'equals', value: 'us-east' }],
            value: false,
            enabled: true,
          },
        ],
      });

      // Verify second config
      expect(result.configs[1]).toEqual({
        keyName: 'api.timeout',
        valueType: 'number',
        currentValue: 5000,
        schema: { type: 'number', minimum: 0 },
        rules: [
          {
            priority: 50,
            conditions: [{ attribute: 'tier', operator: 'equals', value: 'premium' }],
            value: 10000,
            enabled: true,
          },
        ],
      });

      expect(mockConfigKeyRepository.findByEnvironment).toHaveBeenCalledWith(
        'org-1',
        'proj-1',
        'env-1',
      );
      expect(mockRuleRepository.findByConfigKey).toHaveBeenCalledTimes(2);
    });

    it('should export configs with no rules', async () => {
      const mockConfigs = [
        {
          id: 'config-1',
          organization_id: 'org-1',
          project_id: 'proj-1',
          environment_id: 'env-1',
          key_name: 'simple.config',
          value_type: 'string',
          current_value: 'value',
          schema: null,
        },
      ];

      (mockConfigKeyRepository.findByEnvironment as jest.Mock).mockResolvedValue(mockConfigs);
      (mockRuleRepository.findByConfigKey as jest.Mock).mockResolvedValue([]);

      const result = await service.exportConfigs('org-1', 'proj-1', 'env-1');

      expect(result.configs).toHaveLength(1);
      expect(result.configs[0].rules).toEqual([]);
    });

    it('should return empty configs array when no configs exist', async () => {
      (mockConfigKeyRepository.findByEnvironment as jest.Mock).mockResolvedValue([]);

      const result = await service.exportConfigs('org-1', 'proj-1', 'env-1');

      expect(result.configs).toEqual([]);
      expect(result.organizationId).toBe('org-1');
      expect(result.projectId).toBe('proj-1');
      expect(result.environmentId).toBe('env-1');
    });
  });
});
