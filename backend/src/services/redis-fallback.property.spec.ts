/**
 * Property Test: Service continues when Redis unavailable
 * 
 * Property 35: For any configuration request when Redis is unavailable,
 * the backend should query PostgreSQL directly and return the correct
 * configuration value without returning a 5xx error.
 * 
 * Validates: Requirements 9.1
 */

import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RuleEngineService } from './rule-engine.service';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { RuleRepository } from '../repositories/rule.repository';
import { AuditLogService } from './audit-log.service';
import { ConfigKey } from '../entities/config-key.entity';
import { Rule } from '../entities/rule.entity';
import { Context } from '../types/models';

describe('Property 35: Service continues when Redis unavailable', () => {
  let ruleEngineService: RuleEngineService;
  let configKeyRepository: ConfigKeyRepository;
  let ruleRepository: RuleRepository;
  let mockCacheService: any;

  beforeEach(async () => {
    // Create a mock cache service that simulates Redis being unavailable
    mockCacheService = {
      get: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
      set: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
      invalidate: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
      invalidateConfig: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
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

  it('should query PostgreSQL directly when Redis is unavailable', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary config key data
        fc.record({
          id: fc.uuid(),
          organization_id: fc.uuid(),
          project_id: fc.uuid(),
          environment_id: fc.uuid(),
          key_name: fc.string({ minLength: 1, maxLength: 50 }),
          value_type: fc.constantFrom('boolean', 'string', 'number', 'json'),
          current_value: fc.oneof(
            fc.boolean(),
            fc.string(),
            fc.integer(),
            fc.jsonValue(),
          ),
        }),
        // Generate arbitrary context
        fc.record({
          user_id: fc.option(fc.uuid(), { nil: undefined }),
          region: fc.option(fc.constantFrom('us-east-1', 'us-west-2', 'eu-west-1'), { nil: undefined }),
          app_version: fc.option(fc.string(), { nil: undefined }),
          tier: fc.option(fc.constantFrom('free', 'pro', 'enterprise'), { nil: undefined }),
        }),
        async (configKeyData, context: Context) => {
          // Setup: Mock the repository to return the config key
          const configKey = {
            ...configKeyData,
            deleted_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          } as unknown as ConfigKey;

          jest.spyOn(configKeyRepository, 'findById').mockResolvedValue(configKey);
          jest.spyOn(ruleRepository, 'findEnabledByConfigKey').mockResolvedValue([]);

          // Execute: Call evaluate with Redis unavailable
          const result = await ruleEngineService.evaluate(configKey.id, context);

          // Verify: Should return the default value from config key
          // Property 35: Service continues when Redis unavailable
          expect(result).toEqual(configKey.current_value);

          // Verify: PostgreSQL was queried (repository methods were called)
          expect(configKeyRepository.findById).toHaveBeenCalledWith(configKey.id);
          expect(ruleRepository.findEnabledByConfigKey).toHaveBeenCalledWith(configKey.id);

          // Verify: Cache get was attempted but failed (Redis unavailable)
          expect(mockCacheService.get).toHaveBeenCalled();

          // Verify: Cache set was attempted but failed (best effort)
          expect(mockCacheService.set).toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should handle Redis unavailability with rules present', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate config key
        fc.record({
          id: fc.uuid(),
          organization_id: fc.uuid(),
          project_id: fc.uuid(),
          environment_id: fc.uuid(),
          key_name: fc.string({ minLength: 1, maxLength: 50 }),
          value_type: fc.constantFrom('boolean', 'string', 'number'),
          current_value: fc.oneof(fc.boolean(), fc.string(), fc.integer()),
        }),
        // Generate a matching rule
        fc.record({
          id: fc.uuid(),
          priority: fc.integer({ min: 1, max: 100 }),
          value: fc.oneof(fc.boolean(), fc.string(), fc.integer()),
          enabled: fc.constant(true),
        }),
        // Generate context that matches the rule
        fc.record({
          user_id: fc.uuid(),
          region: fc.constantFrom('us-east-1', 'us-west-2'),
        }),
        async (configKeyData, ruleData, context: Context) => {
          // Setup: Create config key and rule
          const configKey = {
            ...configKeyData,
            deleted_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          } as unknown as ConfigKey;

          const rule = {
            ...ruleData,
            config_key_id: configKey.id,
            conditions: [
              {
                attribute: 'region',
                operator: 'equals',
                value: context.region,
              },
            ],
            created_at: new Date(),
            updated_at: new Date(),
          } as unknown as Rule;

          jest.spyOn(configKeyRepository, 'findById').mockResolvedValue(configKey);
          jest.spyOn(ruleRepository, 'findEnabledByConfigKey').mockResolvedValue([rule]);

          // Execute: Evaluate with Redis unavailable
          const result = await ruleEngineService.evaluate(configKey.id, context);

          // Verify: Should return the rule value (rule matched)
          // Property 35: Service continues when Redis unavailable
          expect(result).toEqual(rule.value);

          // Verify: PostgreSQL was queried
          expect(configKeyRepository.findById).toHaveBeenCalled();
          expect(ruleRepository.findEnabledByConfigKey).toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});
