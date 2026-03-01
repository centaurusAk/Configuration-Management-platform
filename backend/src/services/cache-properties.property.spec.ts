import * as fc from 'fast-check';
import { RedisCacheService } from './redis-cache.service';
import { buildCacheKey, hashContext } from './cache.service';
import { Context } from '../types/models';
import { RuleEngineService } from './rule-engine.service';
import { ConfigService } from './config.service';
import { RuleRepository } from '../repositories/rule.repository';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { ConfigVersionRepository } from '../repositories/config-version.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { ValidationService } from './validation.service';

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
  scan: jest.fn(),
  quit: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

/**
 * Property-Based Tests for Caching Layer
 * 
 * These tests validate the correctness properties for the caching system:
 * - Property 23: Cache checked before database
 * - Property 24: Cache miss populates cache
 * - Property 25: Config updates invalidate cache
 * - Property 26: Rule changes invalidate cache
 * - Property 27: Cache keys follow specified format
 */
describe('Caching Properties', () => {
  let cacheService: RedisCacheService;
  let ruleEngineService: RuleEngineService;
  let configService: ConfigService;
  let mockRuleRepository: jest.Mocked<RuleRepository>;
  let mockConfigKeyRepository: jest.Mocked<ConfigKeyRepository>;
  let mockConfigVersionRepository: jest.Mocked<ConfigVersionRepository>;
  let mockAuditLogRepository: jest.Mocked<AuditLogRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create cache service
    cacheService = new RedisCacheService();

    // Create mock repositories
    mockRuleRepository = {
      findByConfigKey: jest.fn(),
      findEnabledByConfigKey: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockConfigKeyRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as any;

    mockConfigVersionRepository = {
      create: jest.fn(),
      findByConfigKey: jest.fn(),
    } as any;

    mockAuditLogRepository = {
      create: jest.fn(),
    } as any;

    const mockAuditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([]),
    } as any;

    // Create services
    ruleEngineService = new RuleEngineService(
      mockRuleRepository,
      mockConfigKeyRepository,
      cacheService,
      mockAuditLogService
    );

    const validationService = new ValidationService();

    configService = new ConfigService(
      mockConfigKeyRepository,
      mockConfigVersionRepository,
      mockAuditLogRepository,
      mockRuleRepository,
      cacheService,
      validationService
    );
  });

  afterEach(async () => {
    await cacheService.close();
  });

  /**
   * Property 27: Cache keys follow specified format
   * 
   * **Validates: Requirements 6.6**
   * 
   * For any configuration cache entry, the Redis key should match the format:
   * config:{org_id}:{project_id}:{env_id}:{key_name}:{context_hash}
   * where context_hash is a deterministic hash of the sorted context attributes.
   */
  describe('Property 27: Cache key format', () => {
    it('should generate cache keys in the correct format', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0 && !s.includes(':')),
          fc.record({
            user_id: fc.option(fc.string(), { nil: undefined }),
            region: fc.option(fc.string(), { nil: undefined }),
            app_version: fc.option(fc.string(), { nil: undefined }),
            tier: fc.option(fc.string(), { nil: undefined }),
          }),
          (orgId, projectId, envId, keyName, context) => {
            const cacheKey = buildCacheKey(orgId, projectId, envId, keyName, context);

            // Verify format: config:{org}:{project}:{env}:{key}:{hash}
            const parts = cacheKey.split(':');
            
            expect(parts[0]).toBe('config');
            expect(parts[1]).toBe(orgId);
            expect(parts[2]).toBe(projectId);
            expect(parts[3]).toBe(envId);
            expect(parts[4]).toBe(keyName);
            expect(parts[5]).toBeDefined();
            expect(parts[5].length).toBe(16); // Hash is 16 characters
            expect(parts.length).toBe(6);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate deterministic context hashes', () => {
      fc.assert(
        fc.property(
          fc.record({
            user_id: fc.option(fc.string(), { nil: undefined }),
            region: fc.option(fc.string(), { nil: undefined }),
            app_version: fc.option(fc.string(), { nil: undefined }),
            tier: fc.option(fc.string(), { nil: undefined }),
          }),
          (context) => {
            const hash1 = hashContext(context);
            const hash2 = hashContext(context);

            // Same context should produce same hash
            expect(hash1).toBe(hash2);
            expect(hash1.length).toBe(16);
            expect(/^[0-9a-f]{16}$/.test(hash1)).toBe(true); // Hex string
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate same hash regardless of key insertion order', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          fc.string(),
          (userId, region, appVersion) => {
            // Create context with keys in different orders
            const context1: Context = {
              user_id: userId,
              region: region,
              app_version: appVersion,
            };

            const context2: Context = {
              app_version: appVersion,
              user_id: userId,
              region: region,
            };

            const hash1 = hashContext(context1);
            const hash2 = hashContext(context2);

            // Should produce same hash regardless of order
            expect(hash1).toBe(hash2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 23: Cache checked before database
   * 
   * **Validates: Requirements 6.1, 6.2**
   * 
   * For any configuration request, when the Redis cache contains a valid entry
   * for the request, the database should not be queried.
   */
  describe('Property 23: Cache-first behavior', () => {
    it('should check cache before querying database', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.record({
            user_id: fc.option(fc.string().filter(s => s.length > 0), { nil: undefined }),
            region: fc.option(fc.string().filter(s => s.length > 0), { nil: undefined }),
          }),
          fc.oneof(fc.boolean(), fc.string(), fc.integer()),
          async (configId, orgId, projectId, envId, keyName, context, cachedValue) => {
            // Setup: Cache contains a value
            mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cachedValue));

            // Setup: Config exists in database
            mockConfigKeyRepository.findById.mockResolvedValueOnce({
              id: configId,
              organization_id: orgId,
              project_id: projectId,
              environment_id: envId,
              key_name: keyName,
              value_type: 'string',
              current_value: 'default',
            } as any);

            // Execute: Evaluate config
            const result = await ruleEngineService.evaluate(configId, context);

            // Verify: Cache was checked
            expect(mockRedisClient.get).toHaveBeenCalled();

            // Verify: Result matches cached value
            expect(result).toEqual(cachedValue);

            // Verify: Database was NOT queried for rules (cache hit)
            expect(mockRuleRepository.findEnabledByConfigKey).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should query database only on cache miss', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.record({
            user_id: fc.option(fc.string().filter(s => s.length > 0), { nil: undefined }),
          }),
          async (configId, orgId, projectId, envId, keyName, context) => {
            // Setup: Cache miss (returns null)
            mockRedisClient.get.mockResolvedValueOnce(null);
            mockRedisClient.setEx.mockResolvedValueOnce(undefined);

            // Setup: Config exists with default value
            const defaultValue = 'default-value';
            mockConfigKeyRepository.findById.mockResolvedValueOnce({
              id: configId,
              organization_id: orgId,
              project_id: projectId,
              environment_id: envId,
              key_name: keyName,
              value_type: 'string',
              current_value: defaultValue,
            } as any);

            // Setup: No rules match
            mockRuleRepository.findEnabledByConfigKey = jest.fn().mockResolvedValueOnce([]);

            // Execute: Evaluate config
            const result = await ruleEngineService.evaluate(configId, context);

            // Verify: Cache was checked first
            expect(mockRedisClient.get).toHaveBeenCalled();

            // Verify: Database was queried (cache miss)
            expect(mockConfigKeyRepository.findById).toHaveBeenCalled();
            expect(mockRuleRepository.findEnabledByConfigKey).toHaveBeenCalled();

            // Verify: Result is correct
            expect(result).toBe(defaultValue);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 24: Cache miss populates cache
   * 
   * **Validates: Requirements 6.3**
   * 
   * For any configuration request where Redis cache does not contain an entry,
   * after the request completes successfully, the Redis cache should contain
   * an entry for that configuration with 60-second TTL.
   */
  describe('Property 24: Cache population on miss', () => {
    it('should populate cache with 60s TTL on cache miss', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.record({
            user_id: fc.option(fc.string().filter(s => s.length > 0), { nil: undefined }),
            region: fc.option(fc.string().filter(s => s.length > 0), { nil: undefined }),
          }),
          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0 && !['__proto__', 'constructor', 'prototype', 'toString'].includes(s)),
          async (configId, orgId, projectId, envId, keyName, context, configValue) => {
            // Reset mocks for this iteration
            jest.clearAllMocks();

            // Setup: Cache miss
            mockRedisClient.get.mockResolvedValueOnce(null);
            mockRedisClient.setEx.mockResolvedValueOnce(undefined);

            // Setup: Config exists
            mockConfigKeyRepository.findById.mockResolvedValueOnce({
              id: configId,
              organization_id: orgId,
              project_id: projectId,
              environment_id: envId,
              key_name: keyName,
              value_type: 'string',
              current_value: configValue,
            } as any);

            // Setup: No rules
            mockRuleRepository.findEnabledByConfigKey = jest.fn().mockResolvedValueOnce([]);

            // Execute: Evaluate config
            await ruleEngineService.evaluate(configId, context);

            // Verify: Cache was populated
            expect(mockRedisClient.setEx).toHaveBeenCalled();

            // Verify: TTL is 60 seconds
            const setExCall = mockRedisClient.setEx.mock.calls[0];
            expect(setExCall[1]).toBe(60);

            // Verify: Cached value matches result
            const cachedValue = JSON.parse(setExCall[2]);
            expect(cachedValue).toEqual(configValue);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 25: Config updates invalidate cache
   * 
   * **Validates: Requirements 6.4**
   * 
   * For any config key update, immediately after the update completes,
   * all Redis cache entries matching the pattern
   * config:{org_id}:{project_id}:{env_id}:{key_name}:* should be deleted.
   */
  describe('Property 25: Cache invalidation on config updates', () => {
    it('should invalidate all cache entries for updated config', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0 && !['__proto__', 'constructor', 'prototype', 'toString'].includes(s)),
          async (configId, newValue) => {
            // Reset mocks for this iteration
            jest.clearAllMocks();

            // Setup: Config exists
            const configKey = {
              id: configId,
              organization_id: 'org-1',
              project_id: 'proj-1',
              environment_id: 'env-1',
              key_name: 'test-key',
              value_type: 'string',
              current_value: 'old-value',
            };

            mockConfigKeyRepository.findById.mockResolvedValueOnce(configKey as any);
            mockConfigKeyRepository.update.mockResolvedValueOnce({
              ...configKey,
              current_value: newValue,
            } as any);
            mockConfigVersionRepository.create.mockResolvedValueOnce({
              id: 'version-id',
              config_key_id: configId,
              value: newValue,
              created_by: 'user-1',
            } as any);
            mockAuditLogRepository.create.mockResolvedValueOnce({
              id: 'audit-id',
              timestamp: new Date(),
              user_id: 'user-1',
              organization_id: 'org-1',
              action_type: 'UPDATE',
              resource_type: 'CONFIG_KEY',
              resource_id: configId,
              old_value: 'old-value',
              new_value: newValue,
            } as any);

            // Setup: Mock cache operations - multiple invalidation calls
            // First call: invalidate by ID
            mockRedisClient.scan.mockResolvedValueOnce({
              cursor: 0,
              keys: [`config_key:${configId}`],
            });
            mockRedisClient.del.mockResolvedValueOnce(1);

            // Second call: invalidate by name
            mockRedisClient.scan.mockResolvedValueOnce({
              cursor: 0,
              keys: ['config_key:org-1:proj-1:env-1:test-key'],
            });
            mockRedisClient.del.mockResolvedValueOnce(1);

            // Third call: invalidate context-specific entries
            mockRedisClient.scan.mockResolvedValueOnce({
              cursor: 0,
              keys: [
                'config:org-1:proj-1:env-1:test-key:hash1',
                'config:org-1:proj-1:env-1:test-key:hash2',
              ],
            });
            mockRedisClient.del.mockResolvedValueOnce(2);

            // Execute: Update config
            await configService.update(configId, {
              value: newValue,
              updatedBy: 'user-1',
            });

            // Verify: Cache invalidation was called multiple times
            expect(mockRedisClient.scan).toHaveBeenCalledTimes(3);
            expect(mockRedisClient.del).toHaveBeenCalledTimes(3);

            // Verify: Third call used correct pattern for context-specific entries
            const thirdScanCall = mockRedisClient.scan.mock.calls[2];
            const pattern = thirdScanCall[1].MATCH;
            expect(pattern).toMatch(/config:org-1:proj-1:env-1:test-key:\*/);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 26: Rule changes invalidate cache
   * 
   * **Validates: Requirements 6.5**
   * 
   * For any rule creation or modification for a config key, immediately after
   * the change completes, all Redis cache entries for that config key should
   * be deleted.
   */
  describe('Property 26: Cache invalidation on rule changes', () => {
    it('should invalidate cache when rule is created', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 1, max: 100 }),
          fc.oneof(fc.boolean(), fc.string(), fc.integer()),
          async (configKeyId, priority, ruleValue) => {
            // Setup: Config exists
            const configKey = {
              id: configKeyId,
              organization_id: 'org-1',
              project_id: 'proj-1',
              environment_id: 'env-1',
              key_name: 'test-key',
            };

            mockConfigKeyRepository.findById.mockResolvedValueOnce(configKey as any);
            mockConfigKeyRepository.findById.mockResolvedValueOnce(configKey as any);
            mockRuleRepository.create.mockResolvedValueOnce({
              id: 'rule-id',
              config_key_id: configKeyId,
              priority: priority,
              conditions: [],
              value: ruleValue,
              enabled: true,
            } as any);

            // Setup: Mock cache operations
            mockRedisClient.scan.mockResolvedValueOnce({
              cursor: 0,
              keys: ['config:org-1:proj-1:env-1:test-key:hash1'],
            });
            mockRedisClient.del.mockResolvedValueOnce(1);

            // Execute: Create rule
            await ruleEngineService.createRule(
              configKeyId,
              priority,
              [],
              ruleValue,
              'test-user',
              true
            );

            // Verify: Cache was invalidated
            expect(mockRedisClient.scan).toHaveBeenCalled();
            expect(mockRedisClient.del).toHaveBeenCalled();

            // Verify: Correct pattern was used
            const scanCall = mockRedisClient.scan.mock.calls[0];
            const pattern = scanCall[1].MATCH;
            expect(pattern).toMatch(/config:org-1:proj-1:env-1:test-key:\*/);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should invalidate cache when rule is updated', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 1, max: 100 }),
          async (ruleId, configKeyId, newPriority) => {
            // Setup: Rule exists
            mockRuleRepository.findById = jest.fn().mockResolvedValueOnce({
              id: ruleId,
              config_key_id: configKeyId,
              priority: 50,
              conditions: [],
              value: 'old-value',
            } as any);

            // Setup: Config exists (called twice: once in updateRule, once in invalidateCacheForConfigKey)
            mockConfigKeyRepository.findById.mockResolvedValueOnce({
              id: configKeyId,
              organization_id: 'org-1',
              project_id: 'proj-1',
              environment_id: 'env-1',
              key_name: 'test-key',
            } as any);
            mockConfigKeyRepository.findById.mockResolvedValueOnce({
              id: configKeyId,
              organization_id: 'org-1',
              project_id: 'proj-1',
              environment_id: 'env-1',
              key_name: 'test-key',
            } as any);

            mockRuleRepository.update.mockResolvedValueOnce({
              id: ruleId,
              config_key_id: configKeyId,
              priority: newPriority,
              conditions: [],
              value: 'old-value',
            } as any);

            // Setup: Mock cache operations
            mockRedisClient.scan.mockResolvedValueOnce({
              cursor: 0,
              keys: ['config:org-1:proj-1:env-1:test-key:hash1'],
            });
            mockRedisClient.del.mockResolvedValueOnce(1);

            // Execute: Update rule
            await ruleEngineService.updateRule(ruleId, {
              priority: newPriority,
            }, 'test-user');

            // Verify: Cache was invalidated
            expect(mockRedisClient.scan).toHaveBeenCalled();
            expect(mockRedisClient.del).toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
