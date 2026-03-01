import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from './config.service';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { ConfigVersionRepository } from '../repositories/config-version.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { RuleRepository } from '../repositories/rule.repository';
import { ConfigKey } from '../entities';
import { ValidationService } from './validation.service';
import { BadRequestException } from '@nestjs/common';

/**
 * Unit Tests for Bulk Operations
 * 
 * **Validates: Requirements 16.2, 16.6**
 * 
 * Tests:
 * - Partial failure rollback (Requirement 16.2)
 * - Cache invalidation for all affected configs (Requirement 16.6)
 */
describe('ConfigService - Bulk Operations Unit Tests', () => {
  let configService: ConfigService;
  let mockConfigKeyRepository: any;
  let mockConfigVersionRepository: any;
  let mockAuditLogRepository: any;
  let mockCacheService: any;
  let mockTransactionManager: any;

  beforeEach(async () => {
    // Mock transaction manager
    mockTransactionManager = {
      update: jest.fn(),
      create: jest.fn((entity, data) => data),
      save: jest.fn((entity, data) => Promise.resolve(data)),
    };

    // Mock repositories
    mockConfigKeyRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      repository: {
        manager: {
          transaction: jest.fn((callback) => callback(mockTransactionManager)),
        },
      },
    };

    mockConfigVersionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      findByConfigKey: jest.fn(),
      countByConfigKey: jest.fn(),
    };

    mockAuditLogRepository = {
      create: jest.fn(),
      save: jest.fn(),
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
          provide: 'CacheService',
          useValue: mockCacheService,
        },
        {
          provide: RuleRepository,
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findByConfigKey: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Partial Failure Rollback (Requirement 16.2)', () => {
    it('should rollback all updates when one config validation fails', async () => {
      // Arrange: Create 3 configs, but make the 2nd one fail validation
      const orgId = 'org-123';
      const projectId = 'proj-456';
      const envId = 'env-789';
      const userId = 'user-abc';

      const config1: Partial<ConfigKey> = {
        id: 'config-1',
        organization_id: orgId,
        project_id: projectId,
        environment_id: envId,
        key_name: 'feature.flag1',
        value_type: 'boolean',
        current_value: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const config2: Partial<ConfigKey> = {
        id: 'config-2',
        organization_id: orgId,
        project_id: projectId,
        environment_id: envId,
        key_name: 'feature.flag2',
        value_type: 'number',
        current_value: 10,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const config3: Partial<ConfigKey> = {
        id: 'config-3',
        organization_id: orgId,
        project_id: projectId,
        environment_id: envId,
        key_name: 'feature.flag3',
        value_type: 'string',
        current_value: 'old',
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock findById to return configs
      mockConfigKeyRepository.findById
        .mockResolvedValueOnce(config1)
        .mockResolvedValueOnce(config2)
        .mockResolvedValueOnce(config3);

      const updates = [
        { configId: 'config-1', value: true },
        { configId: 'config-2', value: 'invalid-string' }, // Wrong type - should fail
        { configId: 'config-3', value: 'new' },
      ];

      // Act & Assert: Bulk update should fail
      await expect(
        configService.bulkUpdate({
          updates,
          updatedBy: userId,
        })
      ).rejects.toThrow(BadRequestException);

      // Assert: Transaction should not have been called (validation fails before transaction)
      expect(mockConfigKeyRepository.repository.manager.transaction).not.toHaveBeenCalled();

      // Assert: No cache invalidation should occur
      expect(mockCacheService.invalidate).not.toHaveBeenCalled();
      expect(mockCacheService.invalidateConfig).not.toHaveBeenCalled();
    });

    it('should rollback all updates when schema validation fails for one config', async () => {
      // Arrange: Create configs with schema validation
      const orgId = 'org-123';
      const projectId = 'proj-456';
      const envId = 'env-789';
      const userId = 'user-abc';

      const config1: Partial<ConfigKey> = {
        id: 'config-1',
        organization_id: orgId,
        project_id: projectId,
        environment_id: envId,
        key_name: 'api.timeout',
        value_type: 'number',
        current_value: 30,
        schema: {
          type: 'number',
          minimum: 1,
          maximum: 60,
        },
        created_at: new Date(),
        updated_at: new Date(),
      };

      const config2: Partial<ConfigKey> = {
        id: 'config-2',
        organization_id: orgId,
        project_id: projectId,
        environment_id: envId,
        key_name: 'api.retries',
        value_type: 'number',
        current_value: 3,
        schema: {
          type: 'number',
          minimum: 0,
          maximum: 10,
        },
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockConfigKeyRepository.findById
        .mockResolvedValueOnce(config1)
        .mockResolvedValueOnce(config2);

      const updates = [
        { configId: 'config-1', value: 45 }, // Valid
        { configId: 'config-2', value: 15 }, // Exceeds maximum - should fail
      ];

      // Act & Assert: Bulk update should fail
      await expect(
        configService.bulkUpdate({
          updates,
          updatedBy: userId,
        })
      ).rejects.toThrow(BadRequestException);

      // Assert: Transaction should not have been called
      expect(mockConfigKeyRepository.repository.manager.transaction).not.toHaveBeenCalled();

      // Assert: No cache invalidation should occur
      expect(mockCacheService.invalidate).not.toHaveBeenCalled();
      expect(mockCacheService.invalidateConfig).not.toHaveBeenCalled();
    });

    it('should rollback transaction when database error occurs during update', async () => {
      // Arrange: Create valid configs but simulate database error
      const orgId = 'org-123';
      const projectId = 'proj-456';
      const envId = 'env-789';
      const userId = 'user-abc';

      const config1: Partial<ConfigKey> = {
        id: 'config-1',
        organization_id: orgId,
        project_id: projectId,
        environment_id: envId,
        key_name: 'feature.flag1',
        value_type: 'boolean',
        current_value: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const config2: Partial<ConfigKey> = {
        id: 'config-2',
        organization_id: orgId,
        project_id: projectId,
        environment_id: envId,
        key_name: 'feature.flag2',
        value_type: 'boolean',
        current_value: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockConfigKeyRepository.findById
        .mockResolvedValueOnce(config1)
        .mockResolvedValueOnce(config2);

      // Simulate database error during transaction
      mockConfigKeyRepository.repository.manager.transaction.mockRejectedValueOnce(
        new Error('Database connection lost')
      );

      const updates = [
        { configId: 'config-1', value: true },
        { configId: 'config-2', value: true },
      ];

      // Act & Assert: Bulk update should fail
      await expect(
        configService.bulkUpdate({
          updates,
          updatedBy: userId,
        })
      ).rejects.toThrow(BadRequestException);

      // Assert: Cache invalidation should not occur (transaction failed)
      expect(mockCacheService.invalidate).not.toHaveBeenCalled();
      expect(mockCacheService.invalidateConfig).not.toHaveBeenCalled();
    });
  });

  describe('Cache Invalidation (Requirement 16.6)', () => {
    it('should invalidate cache for all affected configs after successful bulk update', async () => {
      // Arrange: Create multiple configs
      const orgId = 'org-123';
      const projectId = 'proj-456';
      const envId = 'env-789';
      const userId = 'user-abc';

      const config1: Partial<ConfigKey> = {
        id: 'config-1',
        organization_id: orgId,
        project_id: projectId,
        environment_id: envId,
        key_name: 'feature.flag1',
        value_type: 'boolean',
        current_value: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const config2: Partial<ConfigKey> = {
        id: 'config-2',
        organization_id: orgId,
        project_id: projectId,
        environment_id: envId,
        key_name: 'feature.flag2',
        value_type: 'string',
        current_value: 'old',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const config3: Partial<ConfigKey> = {
        id: 'config-3',
        organization_id: orgId,
        project_id: projectId,
        environment_id: envId,
        key_name: 'feature.flag3',
        value_type: 'number',
        current_value: 10,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockConfigKeyRepository.findById
        .mockResolvedValueOnce(config1)
        .mockResolvedValueOnce(config2)
        .mockResolvedValueOnce(config3);

      const updates = [
        { configId: 'config-1', value: true },
        { configId: 'config-2', value: 'new' },
        { configId: 'config-3', value: 20 },
      ];

      // Act: Execute bulk update
      await configService.bulkUpdate({
        updates,
        updatedBy: userId,
      });

      // Assert: Cache should be invalidated for all 3 configs (3 calls per config)
      expect(mockCacheService.invalidate).toHaveBeenCalledTimes(6);

      // Verify the cache invalidation patterns for each config
      // Each config gets 2 invalidate calls: by ID and by name
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(`config_key:${config1.id}`);
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(
        `config_key:${orgId}:${projectId}:${envId}:${config1.key_name}`
      );
      
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(`config_key:${config2.id}`);
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(
        `config_key:${orgId}:${projectId}:${envId}:${config2.key_name}`
      );
      
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(`config_key:${config3.id}`);
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(
        `config_key:${orgId}:${projectId}:${envId}:${config3.key_name}`
      );

      // Verify invalidateConfig was called for each config
      expect(mockCacheService.invalidateConfig).toHaveBeenCalledTimes(3);
      expect(mockCacheService.invalidateConfig).toHaveBeenCalledWith(
        orgId, projectId, envId, config1.key_name
      );
      expect(mockCacheService.invalidateConfig).toHaveBeenCalledWith(
        orgId, projectId, envId, config2.key_name
      );
      expect(mockCacheService.invalidateConfig).toHaveBeenCalledWith(
        orgId, projectId, envId, config3.key_name
      );
    });

    it('should invalidate cache in correct order after transaction commits', async () => {
      // Arrange: Create configs
      const orgId = 'org-123';
      const projectId = 'proj-456';
      const envId = 'env-789';
      const userId = 'user-abc';

      const config1: Partial<ConfigKey> = {
        id: 'config-1',
        organization_id: orgId,
        project_id: projectId,
        environment_id: envId,
        key_name: 'feature.flag1',
        value_type: 'boolean',
        current_value: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const config2: Partial<ConfigKey> = {
        id: 'config-2',
        organization_id: orgId,
        project_id: projectId,
        environment_id: envId,
        key_name: 'feature.flag2',
        value_type: 'boolean',
        current_value: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockConfigKeyRepository.findById
        .mockResolvedValueOnce(config1)
        .mockResolvedValueOnce(config2);

      const updates = [
        { configId: 'config-1', value: true },
        { configId: 'config-2', value: true },
      ];

      // Track call order
      const callOrder: string[] = [];
      mockConfigKeyRepository.repository.manager.transaction.mockImplementation(
        async (callback: any) => {
          callOrder.push('transaction-start');
          const result = await callback(mockTransactionManager);
          callOrder.push('transaction-end');
          return result;
        }
      );

      mockCacheService.invalidate.mockImplementation(async () => {
        callOrder.push('cache-invalidate');
      });

      // Act: Execute bulk update
      await configService.bulkUpdate({
        updates,
        updatedBy: userId,
      });

      // Assert: Cache invalidation should happen AFTER transaction completes
      // Each config gets 2 invalidate calls (by ID and by name)
      expect(callOrder).toEqual([
        'transaction-start',
        'transaction-end',
        'cache-invalidate',
        'cache-invalidate',
        'cache-invalidate',
        'cache-invalidate',
      ]);
    });

    it('should not invalidate cache if no configs are updated', async () => {
      // Arrange: Empty updates array
      const userId = 'user-abc';

      const updates: any[] = [];

      // Act & Assert: Should throw error for empty updates
      await expect(
        configService.bulkUpdate({
          updates,
          updatedBy: userId,
        })
      ).rejects.toThrow(BadRequestException);

      // Assert: No cache invalidation should occur
      expect(mockCacheService.invalidate).not.toHaveBeenCalled();
      expect(mockCacheService.invalidateConfig).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single config bulk update', async () => {
      // Arrange: Single config update
      const orgId = 'org-123';
      const projectId = 'proj-456';
      const envId = 'env-789';
      const userId = 'user-abc';

      const config1: Partial<ConfigKey> = {
        id: 'config-1',
        organization_id: orgId,
        project_id: projectId,
        environment_id: envId,
        key_name: 'feature.flag1',
        value_type: 'boolean',
        current_value: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockConfigKeyRepository.findById.mockResolvedValueOnce(config1);

      const updates = [{ configId: 'config-1', value: true }];

      // Act: Execute bulk update
      await configService.bulkUpdate({
        updates,
        updatedBy: userId,
      });

      // Assert: Should work correctly with single update
      expect(mockConfigKeyRepository.repository.manager.transaction).toHaveBeenCalled();
      // Each config gets 2 invalidate calls (by ID and by name)
      expect(mockCacheService.invalidate).toHaveBeenCalledTimes(2);
    });
  });
});
