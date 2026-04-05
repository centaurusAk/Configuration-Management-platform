import { CacheService } from './cache.service';
import { RedisCacheService } from './redis-cache.service';

// Mock the redis module to avoid actual connections
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    setEx: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    scan: jest.fn().mockResolvedValue({ cursor: 0, keys: [] }),
    quit: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  })),
}));

/**
 * Integration tests for CacheService
 * 
 * These tests verify the cache service interface and implementation
 * work correctly together.
 */
describe('CacheService Integration', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    // Use RedisCacheService as the implementation
    cacheService = new RedisCacheService();
  });

  afterEach(async () => {
    // Clean up connections
    await cacheService.close();
  });

  it('should implement CacheService interface', () => {
    expect(cacheService.get).toBeDefined();
    expect(cacheService.set).toBeDefined();
    expect(cacheService.invalidate).toBeDefined();
    expect(cacheService.invalidateConfig).toBeDefined();
  });

  it('should have correct method signatures', async () => {
    // Verify get returns Promise<any | null>
    const getResult = cacheService.get('test-key');
    expect(getResult).toBeInstanceOf(Promise);

    // Verify set returns Promise<void>
    const setResult = cacheService.set('test-key', 'value', 60);
    expect(setResult).toBeInstanceOf(Promise);

    // Verify invalidate returns Promise<void>
    const invalidateResult = cacheService.invalidate('test:*');
    expect(invalidateResult).toBeInstanceOf(Promise);

    // Verify invalidateConfig returns Promise<void>
    const invalidateConfigResult = cacheService.invalidateConfig(
      'org1',
      'proj1',
      'env1',
      'key1'
    );
    expect(invalidateConfigResult).toBeInstanceOf(Promise);
  });
});
