import * as fc from 'fast-check';
import { ConfigClient } from './client';
import { SDKConfig, Context } from './types';

/**
 * Property 11: Context is included in SDK requests
 * Feature: config-management-platform
 * Validates: Requirements 4.1, 5.3
 * 
 * For any SDK configuration request, the HTTP request payload should contain 
 * the Context object with all provided attributes.
 */
describe('Property 11: SDK Context Inclusion', () => {
  let mockFetch: jest.Mock;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    // Mock fetch globally
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

  it('should include context in all SDK requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user_id: fc.option(fc.string(), { nil: undefined }),
          region: fc.option(fc.oneof(fc.constant('US'), fc.constant('EU'), fc.constant('IN')), { nil: undefined }),
          app_version: fc.option(fc.string(), { nil: undefined }),
          tier: fc.option(fc.oneof(fc.constant('free'), fc.constant('premium'), fc.constant('enterprise')), { nil: undefined }),
        }),
        async (context: Context) => {
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
            projectId: 'test-project',
            environmentId: 'test-env',
          };

          const client = new ConfigClient(config, context);
          
          try {
            await client.initialize();

            // Verify fetch was called
            expect(mockFetch).toHaveBeenCalled();

            // Get the request body from the fetch call
            const fetchCall = mockFetch.mock.calls[0];
            const requestBody = JSON.parse(fetchCall[1].body);

            // Verify context is included in request
            expect(requestBody).toHaveProperty('context');
            expect(requestBody.context).toEqual(context);

            // Verify all provided context attributes are present
            if (context.user_id !== undefined) {
              expect(requestBody.context.user_id).toBe(context.user_id);
            }
            if (context.region !== undefined) {
              expect(requestBody.context.region).toBe(context.region);
            }
            if (context.app_version !== undefined) {
              expect(requestBody.context.app_version).toBe(context.app_version);
            }
            if (context.tier !== undefined) {
              expect(requestBody.context.tier).toBe(context.tier);
            }
          } finally {
            client.close();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include empty context when no context provided', async () => {
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
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody).toHaveProperty('context');
      expect(requestBody.context).toEqual({});
    } finally {
      client.close();
    }
  });

  it('should update context when setContext is called', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user_id: fc.option(fc.string(), { nil: undefined }),
          region: fc.option(fc.string(), { nil: undefined }),
        }),
        fc.record({
          user_id: fc.option(fc.string(), { nil: undefined }),
          region: fc.option(fc.string(), { nil: undefined }),
        }),
        async (initialContext: Context, newContext: Context) => {
          const config: SDKConfig = {
            apiKey: 'test-api-key',
            apiUrl: 'http://localhost:3000',
            projectId: 'test-project',
            environmentId: 'test-env',
          };

          const client = new ConfigClient(config, initialContext);
          
          try {
            await client.initialize();
            mockFetch.mockClear();

            // Update context
            client.setContext(newContext);
            await client.refresh();

            // Verify new context is used
            const fetchCall = mockFetch.mock.calls[0];
            const requestBody = JSON.parse(fetchCall[1].body);

            expect(requestBody.context).toEqual(newContext);
          } finally {
            client.close();
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
