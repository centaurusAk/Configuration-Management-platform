import * as fc from 'fast-check';
import { ConfigClient } from './client';
import { SDKConfig } from './types';

/**
 * Property 18: SDK serves from cache when backend unreachable
 * Feature: config-management-platform
 * Validates: Requirements 5.5, 12.1, 12.5
 * 
 * For any SDK with populated cache, when the Backend_API is unreachable, 
 * calling get(key) for a cached key should return the cached value without throwing exceptions.
 */
describe('Property 18: SDK Offline Mode', () => {
  it('should serve from cache when backend is unreachable', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.jsonValue()),
        async (configs: Record<string, any>) => {
          // Skip if no configs
          if (Object.keys(configs).length === 0) return;

          let fetchCallCount = 0;
          const mockFetch = jest.fn().mockImplementation(() => {
            fetchCallCount++;
            if (fetchCallCount === 1) {
              // First call succeeds (initialization)
              return Promise.resolve({
                ok: true,
                json: async () => ({ configs }),
                status: 200,
                statusText: 'OK',
              } as Response);
            } else {
              // Subsequent calls fail (network error)
              return Promise.reject(new Error('Network error'));
            }
          });

          const originalFetch = global.fetch;
          global.fetch = mockFetch as any;

          try {
            const config: SDKConfig = {
              apiKey: 'test-api-key',
              apiUrl: 'http://localhost:3000',
              projectId: 'test-project',
              environmentId: 'test-env',
            };

            const client = new ConfigClient(config);
            await client.initialize();

            // Verify cache is populated
            const allConfigs = client.getAll();
            expect(Object.keys(allConfigs).length).toBeGreaterThan(0);

            // Simulate network failure
            await client.refresh();

            // SDK should still serve from cache without throwing
            for (const [key, expectedValue] of Object.entries(configs)) {
              const value = await client.get(key, null);
              expect(value).toEqual(expectedValue);
            }

            client.close();
          } finally {
            global.fetch = originalFetch;
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should not throw exceptions when backend is unreachable', async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'));
    const originalFetch = global.fetch;
    global.fetch = mockFetch as any;

    try {
      const config: SDKConfig = {
        apiKey: 'test-api-key',
        apiUrl: 'http://localhost:3000',
        projectId: 'test-project',
        environmentId: 'test-env',
      };

      const client = new ConfigClient(config);
      
      // Initialize should not throw even if fetch fails
      await expect(client.initialize()).resolves.not.toThrow();

      // Get should not throw even if backend is unreachable
      await expect(client.get('any-key', 'default')).resolves.toBe('default');

      // Refresh should not throw
      await expect(client.refresh()).resolves.not.toThrow();

      client.close();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should continue serving stale cache during extended outage', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string()),
        fc.integer({ min: 2, max: 10 }),
        async (configs: Record<string, any>, failureCount: number) => {
          if (Object.keys(configs).length === 0) return;

          let callCount = 0;
          const mockFetch = jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              // First call succeeds
              return Promise.resolve({
                ok: true,
                json: async () => ({ configs }),
                status: 200,
                statusText: 'OK',
              } as Response);
            } else {
              // All subsequent calls fail
              return Promise.reject(new Error('Network error'));
            }
          });

          const originalFetch = global.fetch;
          global.fetch = mockFetch as any;

          try {
            const config: SDKConfig = {
              apiKey: 'test-api-key',
              apiUrl: 'http://localhost:3000',
              projectId: 'test-project',
              environmentId: 'test-env',
            };

            const client = new ConfigClient(config);
            await client.initialize();

            // Simulate multiple refresh failures
            for (let i = 0; i < failureCount; i++) {
              await client.refresh();
            }

            // SDK should still serve from original cache
            for (const [key, expectedValue] of Object.entries(configs)) {
              const value = await client.get(key, null);
              expect(value).toEqual(expectedValue);
            }

            client.close();
          } finally {
            global.fetch = originalFetch;
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});
