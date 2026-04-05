import * as fc from 'fast-check';
import { ConfigClient } from './client';
import { SDKConfig } from './types';

/**
 * Property 20: SDK authenticates with API key
 * Feature: config-management-platform
 * Validates: Requirements 5.7
 * 
 * For any SDK request to the Backend_API, the HTTP request should include 
 * the API key in the Authorization header.
 */
describe('Property 20: SDK Authentication', () => {
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

  it('should include API key in Authorization header', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 100 }),
        async (apiKey: string) => {
          mockFetch.mockClear();
          mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ configs: {} }),
            status: 200,
            statusText: 'OK',
          } as Response);

          const config: SDKConfig = {
            apiKey,
            apiUrl: 'http://localhost:3000',
            projectId: 'test-project',
            environmentId: 'test-env',
          };

          const client = new ConfigClient(config);
          
          try {
            await client.initialize();

            // Verify fetch was called with Authorization header
            expect(mockFetch).toHaveBeenCalled();

            const fetchCall = mockFetch.mock.calls[0];
            const headers = fetchCall[1].headers;

            expect(headers).toHaveProperty('Authorization');
            expect(headers.Authorization).toBe(`Bearer ${apiKey}`);
          } finally {
            client.close();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include API key in all requests', async () => {
    const apiKey = 'test-api-key-12345';
    const config: SDKConfig = {
      apiKey,
      apiUrl: 'http://localhost:3000',
      projectId: 'test-project',
      environmentId: 'test-env',
    };

    const client = new ConfigClient(config);
    
    try {
      // Initialize (first request)
      await client.initialize();
      expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${apiKey}`);

      mockFetch.mockClear();

      // Manual refresh (second request)
      await client.refresh();
      expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${apiKey}`);
    } finally {
      client.close();
    }
  });

  it('should include project and environment IDs in request', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (projectId: string, environmentId: string) => {
          mockFetch.mockClear();
          mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ configs: {} }),
            status: 200,
            statusText: 'OK',
          } as Response);

          const config: SDKConfig = {
            apiKey: 'test-api-key',
            apiUrl: 'http://localhost:3000',
            projectId,
            environmentId,
          };

          const client = new ConfigClient(config);
          
          try {
            await client.initialize();

            const fetchCall = mockFetch.mock.calls[0];
            const requestBody = JSON.parse(fetchCall[1].body);

            expect(requestBody.projectId).toBe(projectId);
            expect(requestBody.environmentId).toBe(environmentId);
          } finally {
            client.close();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use correct API URL', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webUrl(),
        async (apiUrl: string) => {
          mockFetch.mockClear();

          const config: SDKConfig = {
            apiKey: 'test-api-key',
            apiUrl,
            projectId: 'test-project',
            environmentId: 'test-env',
          };

          const client = new ConfigClient(config);
          
          try {
            await client.initialize();

            const fetchCall = mockFetch.mock.calls[0];
            const requestUrl = fetchCall[0];

            expect(requestUrl).toContain(apiUrl);
            expect(requestUrl).toContain('/api/v1/sdk/configs');
          } finally {
            client.close();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should send POST request with correct content type', async () => {
    const config: SDKConfig = {
      apiKey: 'test-api-key',
      apiUrl: 'http://localhost:3000',
      projectId: 'test-project',
      environmentId: 'test-env',
    };

    const client = new ConfigClient(config);
    
    try {
      await client.initialize();

      const fetchCall = mockFetch.mock.calls[0];
      const options = fetchCall[1];

      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
    } finally {
      client.close();
    }
  });
});
