import { ConfigClient } from './client';
import { SDKConfig } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Unit tests for SDK
 * Requirements: 5.2, 5.4, 5.5, 12.5
 */
describe('ConfigClient', () => {
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

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sdk-test-'));
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const config: SDKConfig = {
        apiKey: 'test-api-key',
        apiUrl: 'http://localhost:3000',
        projectId: 'test-project',
        environmentId: 'test-env',
      };

      const client = new ConfigClient(config);
      await expect(client.initialize()).resolves.not.toThrow();
      client.close();
    });

    it('should fetch configs on initialization', async () => {
      const configs = { key1: 'value1', key2: 'value2' };
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
      await client.initialize();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(await client.get('key1', null)).toBe('value1');
      expect(await client.get('key2', null)).toBe('value2');

      client.close();
    });

    it('should not initialize twice', async () => {
      const config: SDKConfig = {
        apiKey: 'test-api-key',
        apiUrl: 'http://localhost:3000',
        projectId: 'test-project',
        environmentId: 'test-env',
      };

      const client = new ConfigClient(config);
      await client.initialize();
      
      mockFetch.mockClear();
      await client.initialize();

      // Should not fetch again
      expect(mockFetch).not.toHaveBeenCalled();

      client.close();
    });
  });

  describe('refresh timer', () => {
    it('should start automatic refresh timer', async () => {
      jest.useFakeTimers();

      const config: SDKConfig = {
        apiKey: 'test-api-key',
        apiUrl: 'http://localhost:3000',
        projectId: 'test-project',
        environmentId: 'test-env',
        refreshInterval: 1000, // 1 second for testing
      };

      const client = new ConfigClient(config);
      await client.initialize();

      mockFetch.mockClear();

      // Fast-forward time
      jest.advanceTimersByTime(1000);
      await Promise.resolve(); // Allow promises to resolve

      expect(mockFetch).toHaveBeenCalled();

      client.close();
      jest.useRealTimers();
    });

    it('should use default refresh interval of 30 seconds', async () => {
      jest.useFakeTimers();

      const config: SDKConfig = {
        apiKey: 'test-api-key',
        apiUrl: 'http://localhost:3000',
        projectId: 'test-project',
        environmentId: 'test-env',
      };

      const client = new ConfigClient(config);
      await client.initialize();

      mockFetch.mockClear();

      // Should not refresh before 30 seconds
      jest.advanceTimersByTime(29000);
      await Promise.resolve();
      expect(mockFetch).not.toHaveBeenCalled();

      // Should refresh after 30 seconds
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      expect(mockFetch).toHaveBeenCalled();

      client.close();
      jest.useRealTimers();
    });

    it('should stop refresh timer on close', async () => {
      jest.useFakeTimers();

      const config: SDKConfig = {
        apiKey: 'test-api-key',
        apiUrl: 'http://localhost:3000',
        projectId: 'test-project',
        environmentId: 'test-env',
        refreshInterval: 1000,
      };

      const client = new ConfigClient(config);
      await client.initialize();

      client.close();
      mockFetch.mockClear();

      // Should not refresh after close
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      expect(mockFetch).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const config: SDKConfig = {
        apiKey: 'test-api-key',
        apiUrl: 'http://localhost:3000',
        projectId: 'test-project',
        environmentId: 'test-env',
      };

      const client = new ConfigClient(config);
      
      await expect(client.initialize()).resolves.not.toThrow();
      await expect(client.refresh()).resolves.not.toThrow();

      client.close();
    });

    it('should handle HTTP errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      const config: SDKConfig = {
        apiKey: 'test-api-key',
        apiUrl: 'http://localhost:3000',
        projectId: 'test-project',
        environmentId: 'test-env',
      };

      const client = new ConfigClient(config);
      
      await expect(client.initialize()).resolves.not.toThrow();

      client.close();
    });

    it('should handle invalid JSON response gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); },
        status: 200,
        statusText: 'OK',
      } as unknown as Response);

      const config: SDKConfig = {
        apiKey: 'test-api-key',
        apiUrl: 'http://localhost:3000',
        projectId: 'test-project',
        environmentId: 'test-env',
      };

      const client = new ConfigClient(config);
      
      await expect(client.initialize()).resolves.not.toThrow();

      client.close();
    });
  });

  describe('disk cache I/O errors', () => {
    it('should handle disk cache load errors', async () => {
      const cachePath = path.join(tempDir, 'corrupted.json');
      await fs.writeFile(cachePath, 'invalid json', 'utf-8');

      const config: SDKConfig = {
        apiKey: 'test-api-key',
        apiUrl: 'http://localhost:3000',
        projectId: 'test-project',
        environmentId: 'test-env',
        diskCachePath: cachePath,
      };

      const client = new ConfigClient(config);
      
      await expect(client.initialize()).resolves.not.toThrow();

      client.close();
    });

    it('should handle disk cache save errors', async () => {
      const cachePath = '/invalid/path/cache.json';

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
      
      await expect(client.initialize()).resolves.not.toThrow();

      // Should still have configs in memory
      expect(await client.get('key1', null)).toBe('value1');

      client.close();
    });
  });

  describe('context management', () => {
    it('should allow updating context', async () => {
      const config: SDKConfig = {
        apiKey: 'test-api-key',
        apiUrl: 'http://localhost:3000',
        projectId: 'test-project',
        environmentId: 'test-env',
      };

      const client = new ConfigClient(config, { user_id: 'user1' });
      await client.initialize();

      mockFetch.mockClear();

      client.setContext({ user_id: 'user2', region: 'US' });
      await client.refresh();

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.context).toEqual({ user_id: 'user2', region: 'US' });

      client.close();
    });
  });

  describe('getAll', () => {
    it('should return all cached configs', async () => {
      const configs = { key1: 'value1', key2: 'value2', key3: 'value3' };
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
      await client.initialize();

      const allConfigs = client.getAll();
      expect(allConfigs).toEqual(configs);

      client.close();
    });

    it('should return empty object when no configs cached', async () => {
      const config: SDKConfig = {
        apiKey: 'test-api-key',
        apiUrl: 'http://localhost:3000',
        projectId: 'test-project',
        environmentId: 'test-env',
      };

      const client = new ConfigClient(config);
      await client.initialize();

      const allConfigs = client.getAll();
      expect(allConfigs).toEqual({});

      client.close();
    });
  });
});
