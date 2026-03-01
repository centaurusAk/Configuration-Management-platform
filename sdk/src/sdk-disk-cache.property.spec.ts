import * as fc from 'fast-check';
import { ConfigClient } from './client';
import { SDKConfig } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Property 21: SDK persists cache to disk
 * Property 22: SDK loads cache from disk on startup
 * Feature: config-management-platform
 * Validates: Requirements 12.2, 12.3, 12.4
 * 
 * For any SDK with disk cache enabled, after persisting cache to disk and restarting, 
 * loading the cache from disk should restore all previously cached configurations.
 */
describe('Property 21 & 22: SDK Disk Cache Persistence', () => {
  let mockFetch: jest.Mock;
  let originalFetch: typeof global.fetch;
  let tempDir: string;

  beforeEach(async () => {
    originalFetch = global.fetch;
    mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ configs: {} }),
      status: 200,
      statusText: 'OK',
    } as Response);
    global.fetch = mockFetch as any;

    // Create temp directory for cache files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sdk-cache-test-'));
  });

  afterEach(async () => {
    global.fetch = originalFetch;

    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should persist cache to disk and load on restart', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.jsonValue()),
        async (configs: Record<string, any>) => {
          if (Object.keys(configs).length === 0) return;

          const cachePath = path.join(tempDir, `cache-${Date.now()}.json`);

          // First SDK instance - fetch and persist
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ configs }),
            status: 200,
            statusText: 'OK',
          } as Response);

          const config1: SDKConfig = {
            apiKey: 'test-api-key',
            apiUrl: 'http://localhost:3000',
            projectId: 'test-project',
            environmentId: 'test-env',
            diskCachePath: cachePath,
          };

          const client1 = new ConfigClient(config1);
          await client1.initialize();

          // Verify configs are cached
          const cachedConfigs1 = client1.getAll();
          expect(cachedConfigs1).toEqual(configs);

          client1.close();

          // Wait a bit for disk write to complete
          await new Promise(resolve => setTimeout(resolve, 100));

          // Verify cache file exists
          const cacheExists = await fs.access(cachePath).then(() => true).catch(() => false);
          expect(cacheExists).toBe(true);

          // Second SDK instance - should load from disk without fetching
          mockFetch.mockClear();
          mockFetch.mockRejectedValue(new Error('Network should not be called'));

          const config2: SDKConfig = {
            apiKey: 'test-api-key',
            apiUrl: 'http://localhost:3000',
            projectId: 'test-project',
            environmentId: 'test-env',
            diskCachePath: cachePath,
          };

          const client2 = new ConfigClient(config2);
          
          // Initialize should load from disk
          await client2.initialize();

          // Verify all configs are loaded from disk
          const cachedConfigs2 = client2.getAll();
          expect(cachedConfigs2).toEqual(configs);

          // Verify each key individually
          for (const [key, expectedValue] of Object.entries(configs)) {
            const value = await client2.get(key, null);
            expect(value).toEqual(expectedValue);
          }

          client2.close();
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should handle disk cache file not existing', async () => {
    const cachePath = path.join(tempDir, 'non-existent-cache.json');

    const config: SDKConfig = {
      apiKey: 'test-api-key',
      apiUrl: 'http://localhost:3000',
      projectId: 'test-project',
      environmentId: 'test-env',
      diskCachePath: cachePath,
    };

    const client = new ConfigClient(config);
    
    // Should not throw when cache file doesn't exist
    await expect(client.initialize()).resolves.not.toThrow();

    client.close();
  });

  it('should handle corrupted cache file gracefully', async () => {
    const cachePath = path.join(tempDir, 'corrupted-cache.json');

    // Write corrupted JSON to cache file
    await fs.writeFile(cachePath, '{ invalid json }', 'utf-8');

    const config: SDKConfig = {
      apiKey: 'test-api-key',
      apiUrl: 'http://localhost:3000',
      projectId: 'test-project',
      environmentId: 'test-env',
      diskCachePath: cachePath,
    };

    const client = new ConfigClient(config);
    
    // Should not throw when cache file is corrupted
    await expect(client.initialize()).resolves.not.toThrow();

    client.close();
  });

  it('should update disk cache after successful refresh', async () => {
    const cachePath = path.join(tempDir, `cache-update-${Date.now()}.json`);

    const initialConfigs = { key1: 'value1', key2: 'value2' };
    const updatedConfigs = { key1: 'updated1', key2: 'updated2', key3: 'value3' };

    // First fetch returns initial configs
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ configs: initialConfigs }),
      status: 200,
      statusText: 'OK',
    } as Response);

    const config: SDKConfig = {
      apiKey: 'test-api-key',
      apiUrl: 'http://localhost:3000',
      projectId: 'test-project',
      environmentId: 'test-env',
      diskCachePath: cachePath,
    };

    const client = new ConfigClient(config);
    await client.initialize();

    // Wait for disk write
    await new Promise(resolve => setTimeout(resolve, 100));

    // Second fetch returns updated configs
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ configs: updatedConfigs }),
      status: 200,
      statusText: 'OK',
    } as Response);

    await client.refresh();

    // Wait for disk write
    await new Promise(resolve => setTimeout(resolve, 100));

    client.close();

    // Verify disk cache has updated configs
    const diskData = await fs.readFile(cachePath, 'utf-8');
    const parsedData = JSON.parse(diskData);
    expect(parsedData).toEqual(updatedConfigs);
  });

  it('should handle disk write errors gracefully', async () => {
    // Use an invalid path that will cause write errors
    const cachePath = '/invalid/path/that/does/not/exist/cache.json';

    const configs = { key1: 'value1' };

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
      diskCachePath: cachePath,
    };

    const client = new ConfigClient(config);
    
    // Should not throw even if disk write fails
    await expect(client.initialize()).resolves.not.toThrow();

    // Configs should still be in memory cache
    expect(await client.get('key1', null)).toBe('value1');

    client.close();
  });
});
