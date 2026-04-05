import { RedisCacheService } from './redis-cache.service';
import { createClient } from 'redis';

// Mock the redis module
jest.mock('redis', () => ({
  createClient: jest.fn(),
}));

describe('RedisCacheService', () => {
  let service: RedisCacheService;
  let mockRedisClient: any;

  beforeEach(() => {
    // Create mock Redis client
    mockRedisClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      setEx: jest.fn(),
      del: jest.fn(),
      scan: jest.fn(),
      quit: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    };

    (createClient as jest.Mock).mockReturnValue(mockRedisClient);

    service = new RedisCacheService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should return parsed value when key exists', async () => {
      const testValue = { foo: 'bar' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testValue));

      const result = await service.get('test-key');

      expect(result).toEqual(testValue);
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null when key does not exist', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.get('nonexistent-key');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await service.get('error-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value with TTL', async () => {
      const testValue = { foo: 'bar' };
      const ttl = 60;

      await service.set('test-key', testValue, ttl);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'test-key',
        ttl,
        JSON.stringify(testValue)
      );
    });

    it('should not throw on error', async () => {
      mockRedisClient.setEx.mockRejectedValue(new Error('Redis error'));

      await expect(service.set('error-key', 'value', 60)).resolves.not.toThrow();
    });
  });

  describe('invalidate', () => {
    it('should delete all keys matching pattern', async () => {
      const matchingKeys = ['key1', 'key2', 'key3'];
      
      // Mock SCAN to return keys in one iteration
      mockRedisClient.scan.mockResolvedValueOnce({
        cursor: 0,
        keys: matchingKeys,
      });

      await service.invalidate('test:*');

      expect(mockRedisClient.scan).toHaveBeenCalledWith(0, {
        MATCH: 'test:*',
        COUNT: 100,
      });
      expect(mockRedisClient.del).toHaveBeenCalledWith(matchingKeys);
    });

    it('should handle multiple SCAN iterations', async () => {
      // Mock SCAN to return keys in multiple iterations
      mockRedisClient.scan
        .mockResolvedValueOnce({
          cursor: 1,
          keys: ['key1', 'key2'],
        })
        .mockResolvedValueOnce({
          cursor: 2,
          keys: ['key3', 'key4'],
        })
        .mockResolvedValueOnce({
          cursor: 0,
          keys: ['key5'],
        });

      await service.invalidate('test:*');

      expect(mockRedisClient.scan).toHaveBeenCalledTimes(3);
      expect(mockRedisClient.del).toHaveBeenCalledWith([
        'key1',
        'key2',
        'key3',
        'key4',
        'key5',
      ]);
    });

    it('should not call del when no keys match', async () => {
      mockRedisClient.scan.mockResolvedValueOnce({
        cursor: 0,
        keys: [],
      });

      await service.invalidate('nonexistent:*');

      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should not throw on error', async () => {
      mockRedisClient.scan.mockRejectedValue(new Error('Redis error'));

      await expect(service.invalidate('error:*')).resolves.not.toThrow();
    });
  });

  describe('invalidateConfig', () => {
    it('should invalidate all context variations for a config', async () => {
      mockRedisClient.scan.mockResolvedValueOnce({
        cursor: 0,
        keys: [
          'config:org1:proj1:env1:feature-flag:hash1',
          'config:org1:proj1:env1:feature-flag:hash2',
        ],
      });

      await service.invalidateConfig('org1', 'proj1', 'env1', 'feature-flag');

      expect(mockRedisClient.scan).toHaveBeenCalledWith(0, {
        MATCH: 'config:org1:proj1:env1:feature-flag:*',
        COUNT: 100,
      });
      expect(mockRedisClient.del).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close Redis connection', async () => {
      await service.close();

      expect(mockRedisClient.quit).toHaveBeenCalled();
    });

    it('should not throw on error', async () => {
      mockRedisClient.quit.mockRejectedValue(new Error('Redis error'));

      await expect(service.close()).resolves.not.toThrow();
    });
  });
});
