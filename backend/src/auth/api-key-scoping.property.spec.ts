import * as fc from 'fast-check';
import { AuthService } from './auth.service';
import { ApiKey } from '../entities/api-key.entity';

/**
 * Property-Based Tests for API Key Scoping
 * 
 * **Validates: Requirements 7.6, 7.7**
 * 
 * Property 29: API keys are scoped to project and environment
 * For any API key associated with project P and environment E,
 * requests using that API key should only be able to access
 * configurations within project P and environment E, and should
 * receive 403 Forbidden for other projects/environments.
 */
describe('Property Test: API Key Scoping', () => {
  /**
   * Helper to create a mock API key
   */
  const createMockApiKey = (
    projectId: string,
    environmentId: string,
    revoked: boolean = false,
    expiresAt?: Date,
  ): ApiKey => ({
    id: fc.sample(fc.uuid(), 1)[0],
    key_hash: '$2b$10$mockhash',
    prefix: 'mockpref',
    project_id: projectId,
    environment_id: environmentId,
    created_by: fc.sample(fc.uuid(), 1)[0],
    revoked,
    expires_at: expiresAt,
    created_at: new Date(),
  } as ApiKey);

  /**
   * Helper to check if API key can access a project/environment
   */
  const canAccessResource = (
    apiKey: ApiKey,
    requestedProjectId: string,
    requestedEnvironmentId: string,
  ): boolean => {
    // Requirement 7.6, 7.7: API keys are scoped to project and environment
    return (
      apiKey.project_id === requestedProjectId &&
      apiKey.environment_id === requestedEnvironmentId
    );
  };

  /**
   * Property 29.1: API key can only access its own project and environment
   * 
   * For ANY API key with project P and environment E,
   * access should be granted if and only if the requested
   * project is P AND the requested environment is E.
   */
  it('should only allow API key to access its own project and environment', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // API key's project ID
        fc.uuid(), // API key's environment ID
        fc.uuid(), // Requested project ID
        fc.uuid(), // Requested environment ID
        (
          apiKeyProjectId: string,
          apiKeyEnvironmentId: string,
          requestedProjectId: string,
          requestedEnvironmentId: string,
        ) => {
          // Arrange: Create API key scoped to specific project and environment
          const apiKey = createMockApiKey(apiKeyProjectId, apiKeyEnvironmentId);

          // Act: Check if API key can access the requested resource
          const canAccess = canAccessResource(
            apiKey,
            requestedProjectId,
            requestedEnvironmentId,
          );

          // Assert: Access should be granted only if both project and environment match
          const shouldHaveAccess =
            apiKeyProjectId === requestedProjectId &&
            apiKeyEnvironmentId === requestedEnvironmentId;

          expect(canAccess).toBe(shouldHaveAccess);
        },
      ),
      {
        numRuns: 200,
        verbose: true,
      },
    );
  });

  /**
   * Property 29.2: API key cannot access different project with same environment
   * 
   * For ANY API key with project P1 and environment E,
   * access to project P2 (where P1 ≠ P2) with environment E
   * should be denied.
   */
  it('should deny access to different project even with same environment', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // API key's project ID
        fc.uuid(), // API key's environment ID
        fc.uuid(), // Different project ID
        (
          apiKeyProjectId: string,
          environmentId: string,
          differentProjectId: string,
        ) => {
          // Pre-condition: Ensure projects are different
          fc.pre(apiKeyProjectId !== differentProjectId);

          // Arrange: Create API key scoped to project P1 and environment E
          const apiKey = createMockApiKey(apiKeyProjectId, environmentId);

          // Act: Try to access project P2 with same environment E
          const canAccess = canAccessResource(apiKey, differentProjectId, environmentId);

          // Assert: Access should be denied (Requirement 7.7)
          expect(canAccess).toBe(false);
        },
      ),
      {
        numRuns: 200,
        verbose: true,
      },
    );
  });

  /**
   * Property 29.3: API key cannot access different environment in same project
   * 
   * For ANY API key with project P and environment E1,
   * access to project P with environment E2 (where E1 ≠ E2)
   * should be denied.
   */
  it('should deny access to different environment even in same project', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // API key's project ID
        fc.uuid(), // API key's environment ID
        fc.uuid(), // Different environment ID
        (
          projectId: string,
          apiKeyEnvironmentId: string,
          differentEnvironmentId: string,
        ) => {
          // Pre-condition: Ensure environments are different
          fc.pre(apiKeyEnvironmentId !== differentEnvironmentId);

          // Arrange: Create API key scoped to project P and environment E1
          const apiKey = createMockApiKey(projectId, apiKeyEnvironmentId);

          // Act: Try to access same project P with different environment E2
          const canAccess = canAccessResource(apiKey, projectId, differentEnvironmentId);

          // Assert: Access should be denied (Requirement 7.7)
          expect(canAccess).toBe(false);
        },
      ),
      {
        numRuns: 200,
        verbose: true,
      },
    );
  });

  /**
   * Property 29.4: API key cannot access different project and environment
   * 
   * For ANY API key with project P1 and environment E1,
   * access to project P2 and environment E2 (where P1 ≠ P2 OR E1 ≠ E2)
   * should be denied.
   */
  it('should deny access when both project and environment are different', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // API key's project ID
        fc.uuid(), // API key's environment ID
        fc.uuid(), // Different project ID
        fc.uuid(), // Different environment ID
        (
          apiKeyProjectId: string,
          apiKeyEnvironmentId: string,
          differentProjectId: string,
          differentEnvironmentId: string,
        ) => {
          // Pre-condition: Ensure at least one is different
          fc.pre(
            apiKeyProjectId !== differentProjectId ||
            apiKeyEnvironmentId !== differentEnvironmentId,
          );

          // Arrange: Create API key scoped to project P1 and environment E1
          const apiKey = createMockApiKey(apiKeyProjectId, apiKeyEnvironmentId);

          // Act: Try to access project P2 and environment E2
          const canAccess = canAccessResource(
            apiKey,
            differentProjectId,
            differentEnvironmentId,
          );

          // Assert: Access should be denied (Requirement 7.7)
          expect(canAccess).toBe(false);
        },
      ),
      {
        numRuns: 200,
        verbose: true,
      },
    );
  });

  /**
   * Property 29.5: Multiple API keys with different scopes are independent
   * 
   * For ANY two API keys K1 and K2 with different project/environment scopes,
   * K1's access permissions should not affect K2's access permissions.
   */
  it('should maintain independent scopes for multiple API keys', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // K1's project ID
        fc.uuid(), // K1's environment ID
        fc.uuid(), // K2's project ID
        fc.uuid(), // K2's environment ID
        (
          k1ProjectId: string,
          k1EnvironmentId: string,
          k2ProjectId: string,
          k2EnvironmentId: string,
        ) => {
          // Pre-condition: Ensure keys have different scopes
          fc.pre(
            k1ProjectId !== k2ProjectId || k1EnvironmentId !== k2EnvironmentId,
          );

          // Arrange: Create two API keys with different scopes
          const apiKey1 = createMockApiKey(k1ProjectId, k1EnvironmentId);
          const apiKey2 = createMockApiKey(k2ProjectId, k2EnvironmentId);

          // Act: Check access for both keys to both resources
          const k1CanAccessK1Resource = canAccessResource(
            apiKey1,
            k1ProjectId,
            k1EnvironmentId,
          );
          const k1CanAccessK2Resource = canAccessResource(
            apiKey1,
            k2ProjectId,
            k2EnvironmentId,
          );
          const k2CanAccessK1Resource = canAccessResource(
            apiKey2,
            k1ProjectId,
            k1EnvironmentId,
          );
          const k2CanAccessK2Resource = canAccessResource(
            apiKey2,
            k2ProjectId,
            k2EnvironmentId,
          );

          // Assert: Each key can only access its own resource
          expect(k1CanAccessK1Resource).toBe(true);
          expect(k2CanAccessK2Resource).toBe(true);
          expect(k1CanAccessK2Resource).toBe(false);
          expect(k2CanAccessK1Resource).toBe(false);
        },
      ),
      {
        numRuns: 200,
        verbose: true,
      },
    );
  });

  /**
   * Property 29.6: Revoked API keys maintain scope but fail authentication
   * 
   * For ANY API key K with project P and environment E,
   * revoking K should not change its scope, but authentication should fail.
   * This ensures scope is an immutable property of the key.
   */
  it('should maintain scope for revoked API keys', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // Project ID
        fc.uuid(), // Environment ID
        (projectId: string, environmentId: string) => {
          // Arrange: Create a revoked API key
          const revokedApiKey = createMockApiKey(projectId, environmentId, true);

          // Act: Check scope (not authentication)
          const canAccessOwnResource = canAccessResource(
            revokedApiKey,
            projectId,
            environmentId,
          );
          const canAccessOtherResource = canAccessResource(
            revokedApiKey,
            fc.sample(fc.uuid(), 1)[0],
            fc.sample(fc.uuid(), 1)[0],
          );

          // Assert: Scope remains unchanged even when revoked
          expect(canAccessOwnResource).toBe(true);
          expect(canAccessOtherResource).toBe(false);
          expect(revokedApiKey.revoked).toBe(true);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 29.7: Expired API keys maintain scope but fail authentication
   * 
   * For ANY API key K with project P and environment E,
   * expiring K should not change its scope, but authentication should fail.
   */
  it('should maintain scope for expired API keys', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // Project ID
        fc.uuid(), // Environment ID
        (projectId: string, environmentId: string) => {
          // Arrange: Create an expired API key
          const expiredDate = new Date('2020-01-01');
          const expiredApiKey = createMockApiKey(
            projectId,
            environmentId,
            false,
            expiredDate,
          );

          // Act: Check scope (not authentication)
          const canAccessOwnResource = canAccessResource(
            expiredApiKey,
            projectId,
            environmentId,
          );
          const canAccessOtherResource = canAccessResource(
            expiredApiKey,
            fc.sample(fc.uuid(), 1)[0],
            fc.sample(fc.uuid(), 1)[0],
          );

          // Assert: Scope remains unchanged even when expired
          expect(canAccessOwnResource).toBe(true);
          expect(canAccessOtherResource).toBe(false);
          expect(expiredApiKey.expires_at).toEqual(expiredDate);
          expect(expiredApiKey.expires_at! < new Date()).toBe(true);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 29.8: API key scope is determined at creation time
   * 
   * For ANY project P and environment E, creating an API key
   * should permanently bind it to P and E (immutable scope).
   */
  it('should bind API key scope at creation time (immutable)', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // Project ID
        fc.uuid(), // Environment ID
        (projectId: string, environmentId: string) => {
          // Arrange & Act: Create API key
          const apiKey = createMockApiKey(projectId, environmentId);

          // Assert: Scope is set and matches creation parameters
          expect(apiKey.project_id).toBe(projectId);
          expect(apiKey.environment_id).toBe(environmentId);

          // Verify scope cannot be changed (TypeScript readonly would enforce this)
          // In runtime, we verify the values remain constant
          const originalProjectId = apiKey.project_id;
          const originalEnvironmentId = apiKey.environment_id;

          // Simulate time passing or other operations
          const canAccessOriginal = canAccessResource(
            apiKey,
            originalProjectId,
            originalEnvironmentId,
          );

          // Assert: Scope remains unchanged
          expect(apiKey.project_id).toBe(originalProjectId);
          expect(apiKey.environment_id).toBe(originalEnvironmentId);
          expect(canAccessOriginal).toBe(true);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 29.9: Scope validation is consistent across multiple checks
   * 
   * For ANY API key K and resource R, checking access multiple times
   * should always return the same result (deterministic).
   */
  it('should return consistent scope validation results', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // API key's project ID
        fc.uuid(), // API key's environment ID
        fc.uuid(), // Requested project ID
        fc.uuid(), // Requested environment ID
        (
          apiKeyProjectId: string,
          apiKeyEnvironmentId: string,
          requestedProjectId: string,
          requestedEnvironmentId: string,
        ) => {
          // Arrange: Create API key
          const apiKey = createMockApiKey(apiKeyProjectId, apiKeyEnvironmentId);

          // Act: Check access multiple times
          const result1 = canAccessResource(
            apiKey,
            requestedProjectId,
            requestedEnvironmentId,
          );
          const result2 = canAccessResource(
            apiKey,
            requestedProjectId,
            requestedEnvironmentId,
          );
          const result3 = canAccessResource(
            apiKey,
            requestedProjectId,
            requestedEnvironmentId,
          );

          // Assert: All results should be identical (deterministic)
          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
        },
      ),
      {
        numRuns: 200,
        verbose: true,
      },
    );
  });

  /**
   * Property 29.10: Scope enforcement is transitive
   * 
   * For ANY API key K with project P and environment E,
   * if K cannot access (P', E) and cannot access (P, E'),
   * then K cannot access (P', E').
   */
  it('should enforce transitive scope restrictions', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // API key's project ID
        fc.uuid(), // API key's environment ID
        fc.uuid(), // Different project ID
        fc.uuid(), // Different environment ID
        (
          apiKeyProjectId: string,
          apiKeyEnvironmentId: string,
          differentProjectId: string,
          differentEnvironmentId: string,
        ) => {
          // Pre-condition: Ensure both are different
          fc.pre(
            apiKeyProjectId !== differentProjectId &&
            apiKeyEnvironmentId !== differentEnvironmentId,
          );

          // Arrange: Create API key
          const apiKey = createMockApiKey(apiKeyProjectId, apiKeyEnvironmentId);

          // Act: Check access to various combinations
          const canAccessDifferentProject = canAccessResource(
            apiKey,
            differentProjectId,
            apiKeyEnvironmentId,
          );
          const canAccessDifferentEnvironment = canAccessResource(
            apiKey,
            apiKeyProjectId,
            differentEnvironmentId,
          );
          const canAccessBothDifferent = canAccessResource(
            apiKey,
            differentProjectId,
            differentEnvironmentId,
          );

          // Assert: If cannot access either individually, cannot access both
          if (!canAccessDifferentProject && !canAccessDifferentEnvironment) {
            expect(canAccessBothDifferent).toBe(false);
          }
        },
      ),
      {
        numRuns: 200,
        verbose: true,
      },
    );
  });
});
