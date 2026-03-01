import * as fc from 'fast-check';
import { ConfigClient } from './client';
import { SDKConfig } from './types';

/**
 * Property 19: SDK returns default for missing keys
 * Feature: config-management-platform
 * Validates: Requirements 5.6, 12.6
 * 
 * When a configuration key is requested and not in cache, the SDK should 
 * return the provided default value.
 */
describe('Property 19: SDK Default Fallback', () => {
  let mockFetch: jest.Mock;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ configs: {} }),
      status: 200,
      statusText: 'OK',
    } as Response);
    global.fetch = mockFetch as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should return default value for missing keys', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.anything(),
        async (missingKey: string, defaultValue: any) => {
          const config: SDKConfig = {
            apiKey: 'test-api-key',
            apiUrl: 'http://localhost:3000',
            projectId: 'test-project',
            environmentId: 'test-env',
          };

          const client = new ConfigClient(config);
          
          try {
            await client.initialize();

            // Request a key that doesn't exist in cache
            const value = await client.get(missingKey, defaultValue);

            // Should return the default value
            expect(value).toEqual(defaultValue);
          } finally {
            client.close();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return default for different value types', async () => {
    const config: SDKConfig = {
      apiKey: 'test-api-key',
      apiUrl: 'http://localhost:3000',
      projectId: 'test-project',
      environmentId: 'test-env',
    };

    const client = new ConfigClient(config);
    
    try {
      await client.initialize();

      // Boolean default
      expect(await client.get('missing-bool', true)).toBe(true);
      expect(await client.get('missing-bool', false)).toBe(false);

      // String default
      expect(await client.get('missing-string', 'default-value')).toBe('default-value');

      // Number default
      expect(await client.get('missing-number', 42)).toBe(42);

      // Object default
      const objDefault = { key: 'value' };
      expect(await client.get('missing-object', objDefault)).toEqual(objDefault);

      // Array default
      const arrDefault = [1, 2, 3];
      expect(await client.get('missing-array', arrDefault)).toEqual(arrDefault);

      // Null default
      expect(await client.get('missing-null', null)).toBeNull();

      // Undefined default
      expect(await client.get('missing-undefined', undefined)).toBeUndefined();
    } finally {
      client.close();
    }
  });

  it('should return cached value when key exists, not default', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.jsonValue()),
        fc.jsonValue(),
        async (configs: Record<string, any>, defaultValue: any) => {
          if (Object.keys(configs).length === 0) return;

          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ configs }),
            status: 200,
            statusText: 'OK',
          } as Response);

          const config: SDKConfig = {
            apiKey: 'test-api-key',
            apiUrl: 'http://localhost:3000',
            projectId: 'test-project',
            environmentId: 'test-env',
          };

          const client = new ConfigClient(config);
          
          try {
            await client.initialize();

            // For each cached key, should return cached value, not default
            for (const [key, expectedValue] of Object.entries(configs)) {
              const value = await client.get(key, defaultValue);
              expect(value).toEqual(expectedValue);
            }
          } finally {
            client.close();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle default values that match cached values', async () => {
    const configs = {
      'key1': 'value1',
      'key2': 42,
      'key3': true,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ configs }),
      status: 200,
      statusText: 'OK',
    } as Response);

    const config: SDKConfig = {
      apiKey: 'test-api-key',
      apiUrl: 'http://localhost:3000',
      projectId: 'test-project',
      environmentId: 'test-env',
    };

    const client = new ConfigClient(config);
    
    try {
      await client.initialize();

      // Cached value should be returned even if it matches the default
      expect(await client.get('key1', 'value1')).toBe('value1');
      expect(await client.get('key2', 42)).toBe(42);
      expect(await client.get('key3', true)).toBe(true);

      // Missing key should return default
      expect(await client.get('missing', 'value1')).toBe('value1');
    } finally {
      client.close();
    }
  });
});
