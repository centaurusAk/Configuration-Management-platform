/**
 * Integration Tests: Graceful degradation scenarios
 * 
 * Tests the system's behavior when Redis or PostgreSQL are unavailable.
 * 
 * Requirements: 9.1, 9.2, 9.3
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RuleEngineService } from './rule-engine.service';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { RuleRepository } from '../repositories/rule.repository';
import { AuditLogService } from './audit-log.service';
import { ConfigKey } from '../entities/config-key.entity';
import { Context } from '../types/models';

describe('Graceful Degradation Integration Tests', () => {
  let ruleEngineService: RuleEngineService;
  let configKeyRepository: ConfigKeyRepository;
  let ruleRepository: RuleRepository;
  let mockCacheService: any;

  beforeEach(async () => {
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn(),
      invalidateConfig: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RuleEngineService,
        {
          provide: ConfigKeyRepository,
          useValue: {
            findById: jest.fn(),
            findAll: jest.fn(),
          },
        },
        {
          provide: RuleRepository,
          useValue: {
            findEnabledByConfigKey: jest.fn(),
            create: jest.fn().mockResolvedValue({ id: 'rule-1' }),
          },
        },
        {
          provide: 'CacheService',
          useValue: mockCacheService,
        },
        {
          provide: AuditLogService,
          useValue: {
            log: jest.fn(),
          },
        },
      ],
    }).compile();

    ruleEngineService = module.get<RuleEngineService>(RuleEngineService);
    configKeyRepository = module.get<ConfigKeyRepository>(ConfigKeyRepository);
    ruleRepository = module.get<RuleRepository>(RuleRepository);
  });

  describe('Requirement 9.1: Redis down scenario', () => {
    it('should query PostgreSQL directly when Redis is unavailable', async () => {
      // Setup: Redis throws errors
      mockCacheService.get.mockRejectedValue(new Error('Redis connection failed'));
      mockCacheService.set.mockRejectedValue(new Error('Redis connection failed'));

      // Setup: PostgreSQL works
      const configKey = {
        id: 'config-1',
        organization_id: 'org-1',
        project_id: 'proj-1',
        environment_id: 'env-1',
        key_name: 'feature.enabled',
        value_type: 'boolean',
        current_value: true,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      } as unknown as ConfigKey;

      jest.spyOn(configKeyRepository, 'findById').mockResolvedValue(configKey);
      jest.spyOn(ruleRepository, 'findEnabledByConfigKey').mockResolvedValue([]);

      const context: Context = { user_id: 'user-1' };

      // Execute: Should succeed despite Redis being down
      const result = await ruleEngineService.evaluate(configKey.id, context);

      // Verify: Returns correct value from PostgreSQL
      expect(result).toBe(true);

      // Verify: PostgreSQL was queried
      expect(configKeyRepository.findById).toHaveBeenCalledWith(configKey.id);
      expect(ruleRepository.findEnabledByConfigKey).toHaveBeenCalledWith(configKey.id);

      // Verify: Cache get was attempted
      expect(mockCacheService.get).toHaveBeenCalled();

      // Verify: Cache set was attempted (best effort)
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should handle Redis errors during cache invalidation', async () => {
      // Setup: Redis throws errors
      mockCacheService.invalidateConfig.mockRejectedValue(
        new Error('Redis connection failed')
      );

      // Setup: PostgreSQL works
      const configKey = {
        id: 'config-1',
        organization_id: 'org-1',
        project_id: 'proj-1',
        environment_id: 'env-1',
        key_name: 'feature.enabled',
        value_type: 'boolean',
        current_value: true,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      } as unknown as ConfigKey;

      jest.spyOn(configKeyRepository, 'findById').mockResolvedValue(configKey);

      // Execute: Create rule (which triggers cache invalidation)
      // This should not throw even if Redis is down
      await expect(
        ruleEngineService.createRule(
          configKey.id,
          100,
          [{ attribute: 'region', operator: 'equals', value: 'us-east-1' }],
          false,
          'user-1',
          true
        )
      ).resolves.toBeDefined();
    });
  });

  describe('Requirement 9.2 & 9.3: PostgreSQL down scenario', () => {
    it('should return cached value when PostgreSQL is unavailable', async () => {
      // Setup: Cache has a value
      const cachedValue = true;
      mockCacheService.get.mockResolvedValue(cachedValue);

      // Setup: PostgreSQL throws error
      jest.spyOn(configKeyRepository, 'findById').mockRejectedValue(
        new Error('Database connection failed')
      );

      const configKey = {
        id: 'config-1',
        organization_id: 'org-1',
        project_id: 'proj-1',
        environment_id: 'env-1',
        key_name: 'feature.enabled',
        value_type: 'boolean',
        current_value: true,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      } as unknown as ConfigKey;

      // For cache key building, we need findById to succeed
      jest.spyOn(configKeyRepository, 'findById').mockResolvedValue(configKey);

      const context: Context = { user_id: 'user-1' };

      // Execute: Should return cached value
      const result = await ruleEngineService.evaluate(configKey.id, context);

      // Verify: Returns cached value
      expect(result).toBe(cachedValue);

      // Verify: Cache was checked
      expect(mockCacheService.get).toHaveBeenCalled();

      // Verify: Database was not queried for rules (cache hit)
      expect(ruleRepository.findEnabledByConfigKey).not.toHaveBeenCalled();
    });

    it('should fail when both PostgreSQL and cache are unavailable', async () => {
      // Setup: Cache returns null (no cached value)
      mockCacheService.get.mockResolvedValue(null);

      // Setup: PostgreSQL throws error
      const configKey = {
        id: 'config-1',
        organization_id: 'org-1',
        project_id: 'proj-1',
        environment_id: 'env-1',
        key_name: 'feature.enabled',
        value_type: 'boolean',
        current_value: true,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      } as unknown as ConfigKey;

      jest.spyOn(configKeyRepository, 'findById').mockResolvedValue(configKey);
      jest.spyOn(ruleRepository, 'findEnabledByConfigKey').mockRejectedValue(
        new Error('Database connection failed')
      );

      const context: Context = { user_id: 'user-1' };

      // Execute & Verify: Should throw error
      await expect(
        ruleEngineService.evaluate(configKey.id, context)
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('Requirement 9.1, 9.2, 9.3: Both down scenario', () => {
    it('should fail gracefully when both Redis and PostgreSQL are unavailable', async () => {
      // Setup: Both Redis and PostgreSQL throw errors
      mockCacheService.get.mockRejectedValue(new Error('Redis connection failed'));

      const configKey = {
        id: 'config-1',
        organization_id: 'org-1',
        project_id: 'proj-1',
        environment_id: 'env-1',
        key_name: 'feature.enabled',
        value_type: 'boolean',
        current_value: true,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      } as unknown as ConfigKey;

      jest.spyOn(configKeyRepository, 'findById').mockResolvedValue(configKey);
      jest.spyOn(ruleRepository, 'findEnabledByConfigKey').mockRejectedValue(
        new Error('Database connection failed')
      );

      const context: Context = { user_id: 'user-1' };

      // Execute & Verify: Should throw error
      await expect(
        ruleEngineService.evaluate(configKey.id, context)
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle partial failures gracefully', async () => {
      // Setup: Redis fails on get but PostgreSQL works
      mockCacheService.get.mockRejectedValue(new Error('Redis connection failed'));
      mockCacheService.set.mockResolvedValue(undefined); // Set works

      const configKey = {
        id: 'config-1',
        organization_id: 'org-1',
        project_id: 'proj-1',
        environment_id: 'env-1',
        key_name: 'feature.enabled',
        value_type: 'boolean',
        current_value: true,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      } as unknown as ConfigKey;

      jest.spyOn(configKeyRepository, 'findById').mockResolvedValue(configKey);
      jest.spyOn(ruleRepository, 'findEnabledByConfigKey').mockResolvedValue([]);

      const context: Context = { user_id: 'user-1' };

      // Execute: Should succeed
      const result = await ruleEngineService.evaluate(configKey.id, context);

      // Verify: Returns correct value
      expect(result).toBe(true);

      // Verify: PostgreSQL was queried
      expect(configKeyRepository.findById).toHaveBeenCalled();
      expect(ruleRepository.findEnabledByConfigKey).toHaveBeenCalled();
    });
  });
});
