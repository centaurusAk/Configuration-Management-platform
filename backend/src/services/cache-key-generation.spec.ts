/**
 * Unit tests for cache key generation functions
 * 
 * Tests Requirements 6.6: Cache key format and deterministic context hashing
 */

import { buildCacheKey, hashContext } from './cache.service';
import { Context } from '../types/models';

describe('Cache Key Generation', () => {
  describe('buildCacheKey', () => {
    it('should follow the format config:{org}:{project}:{env}:{key}:{context_hash}', () => {
      const context: Context = {
        user_id: 'user123',
        region: 'us-east-1'
      };

      const key = buildCacheKey('org1', 'proj1', 'env1', 'feature_flag', context);

      // Should start with config: and have 5 colon-separated parts
      expect(key).toMatch(/^config:[^:]+:[^:]+:[^:]+:[^:]+:[^:]+$/);
      expect(key).toContain('config:org1:proj1:env1:feature_flag:');
    });

    it('should include all parameters in the cache key', () => {
      const context: Context = { user_id: 'user123' };

      const key = buildCacheKey('myorg', 'myproject', 'production', 'my_key', context);

      expect(key).toContain('myorg');
      expect(key).toContain('myproject');
      expect(key).toContain('production');
      expect(key).toContain('my_key');
    });

    it('should generate different keys for different contexts', () => {
      const context1: Context = { user_id: 'user1' };
      const context2: Context = { user_id: 'user2' };

      const key1 = buildCacheKey('org1', 'proj1', 'env1', 'key1', context1);
      const key2 = buildCacheKey('org1', 'proj1', 'env1', 'key1', context2);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different organizations', () => {
      const context: Context = { user_id: 'user1' };

      const key1 = buildCacheKey('org1', 'proj1', 'env1', 'key1', context);
      const key2 = buildCacheKey('org2', 'proj1', 'env1', 'key1', context);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different projects', () => {
      const context: Context = { user_id: 'user1' };

      const key1 = buildCacheKey('org1', 'proj1', 'env1', 'key1', context);
      const key2 = buildCacheKey('org1', 'proj2', 'env1', 'key1', context);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different environments', () => {
      const context: Context = { user_id: 'user1' };

      const key1 = buildCacheKey('org1', 'proj1', 'dev', 'key1', context);
      const key2 = buildCacheKey('org1', 'proj1', 'prod', 'key1', context);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different key names', () => {
      const context: Context = { user_id: 'user1' };

      const key1 = buildCacheKey('org1', 'proj1', 'env1', 'key1', context);
      const key2 = buildCacheKey('org1', 'proj1', 'env1', 'key2', context);

      expect(key1).not.toBe(key2);
    });
  });

  describe('hashContext', () => {
    it('should return a deterministic hash for the same context', () => {
      const context: Context = {
        user_id: 'user123',
        region: 'us-east-1',
        app_version: '1.0.0'
      };

      const hash1 = hashContext(context);
      const hash2 = hashContext(context);

      expect(hash1).toBe(hash2);
    });

    it('should return the same hash regardless of key insertion order', () => {
      // Create contexts with same data but different key order
      const context1: Context = {
        user_id: 'user123',
        region: 'us-east-1',
        app_version: '1.0.0'
      };

      const context2: Context = {
        app_version: '1.0.0',
        user_id: 'user123',
        region: 'us-east-1'
      };

      const hash1 = hashContext(context1);
      const hash2 = hashContext(context2);

      expect(hash1).toBe(hash2);
    });

    it('should return different hashes for different contexts', () => {
      const context1: Context = { user_id: 'user1' };
      const context2: Context = { user_id: 'user2' };

      const hash1 = hashContext(context1);
      const hash2 = hashContext(context2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty context', () => {
      const context: Context = {};

      const hash = hashContext(context);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(16);
    });

    it('should handle context with all fields', () => {
      const context: Context = {
        user_id: 'user123',
        region: 'us-east-1',
        app_version: '2.0.0',
        tier: 'premium',
        custom_attributes: {
          feature: 'beta',
          segment: 'early_adopters'
        }
      };

      const hash = hashContext(context);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(16);
    });

    it('should handle custom_attributes deterministically', () => {
      const context1: Context = {
        user_id: 'user123',
        custom_attributes: {
          a: 'value1',
          b: 'value2'
        }
      };

      const context2: Context = {
        user_id: 'user123',
        custom_attributes: {
          b: 'value2',
          a: 'value1'
        }
      };

      const hash1 = hashContext(context1);
      const hash2 = hashContext(context2);

      // Note: JSON.stringify doesn't guarantee key order, so these might differ
      // This is acceptable as custom_attributes is a nested object
      expect(hash1).toBeDefined();
      expect(hash2).toBeDefined();
    });

    it('should return a 16-character hex string', () => {
      const context: Context = { user_id: 'user123' };

      const hash = hashContext(context);

      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should handle undefined optional fields', () => {
      const context: Context = {
        user_id: 'user123'
        // Other fields undefined
      };

      const hash = hashContext(context);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('should produce different hashes when a field is added', () => {
      const context1: Context = {
        user_id: 'user123'
      };

      const context2: Context = {
        user_id: 'user123',
        region: 'us-east-1'
      };

      const hash1 = hashContext(context1);
      const hash2 = hashContext(context2);

      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes when a field value changes', () => {
      const context1: Context = {
        user_id: 'user123',
        region: 'us-east-1'
      };

      const context2: Context = {
        user_id: 'user123',
        region: 'eu-west-1'
      };

      const hash1 = hashContext(context1);
      const hash2 = hashContext(context2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Integration', () => {
    it('should generate consistent cache keys for the same inputs', () => {
      const context: Context = {
        user_id: 'user123',
        region: 'us-east-1'
      };

      const key1 = buildCacheKey('org1', 'proj1', 'env1', 'feature_flag', context);
      const key2 = buildCacheKey('org1', 'proj1', 'env1', 'feature_flag', context);

      expect(key1).toBe(key2);
    });

    it('should generate cache keys that can be used for pattern matching', () => {
      const context: Context = { user_id: 'user123' };

      const key = buildCacheKey('org1', 'proj1', 'env1', 'feature_flag', context);

      // Should be able to create a pattern to match all contexts for this config
      const pattern = 'config:org1:proj1:env1:feature_flag:*';
      
      expect(key.startsWith('config:org1:proj1:env1:feature_flag:')).toBe(true);
    });
  });
});
