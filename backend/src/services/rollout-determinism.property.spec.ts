import * as fc from 'fast-check';
import { isUserInRollout } from './rollout.utils';

/**
 * Property-Based Tests for Percentage Rollout Determinism
 * 
 * **Validates: Requirements 3.1, 3.5**
 * 
 * Property 9: Percentage rollout is deterministic
 * For any user ID, config key, and percentage value, evaluating the rollout
 * multiple times should always return the same result (either rollout value
 * or default value).
 */
describe('Property Test: Percentage Rollout Determinism', () => {
  /**
   * Property 9: Percentage rollout is deterministic
   * 
   * This property tests that for ANY user ID, config key, and percentage,
   * the rollout decision is consistent across multiple evaluations.
   */
  it('should return the same result for the same inputs across multiple evaluations', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 255 }), // userId
        fc.string({ minLength: 1, maxLength: 255 }), // configKey
        fc.integer({ min: 0, max: 100 }), // percentage
        (userId: string, configKey: string, percentage: number) => {
          // Evaluate the rollout decision multiple times
          const result1 = isUserInRollout(userId, configKey, percentage);
          const result2 = isUserInRollout(userId, configKey, percentage);
          const result3 = isUserInRollout(userId, configKey, percentage);
          const result4 = isUserInRollout(userId, configKey, percentage);
          const result5 = isUserInRollout(userId, configKey, percentage);

          // Property: All results should be identical (deterministic)
          expect(result1).toBe(result2);
          expect(result1).toBe(result3);
          expect(result1).toBe(result4);
          expect(result1).toBe(result5);

          // Property: Result should be a boolean
          expect(typeof result1).toBe('boolean');
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 9 (Extended): Determinism with input normalization
   * 
   * Tests that the same user/config with different casing and whitespace
   * produces the same result due to normalization.
   */
  it('should return the same result for normalized inputs (case and whitespace)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 255 }), // userId
        fc.string({ minLength: 1, maxLength: 255 }), // configKey
        fc.integer({ min: 0, max: 100 }), // percentage
        (userId: string, configKey: string, percentage: number) => {
          // Test with original inputs
          const result1 = isUserInRollout(userId, configKey, percentage);

          // Test with uppercase
          const result2 = isUserInRollout(
            userId.toUpperCase(),
            configKey.toUpperCase(),
            percentage,
          );

          // Test with lowercase
          const result3 = isUserInRollout(
            userId.toLowerCase(),
            configKey.toLowerCase(),
            percentage,
          );

          // Test with extra whitespace
          const result4 = isUserInRollout(
            `  ${userId}  `,
            `  ${configKey}  `,
            percentage,
          );

          // Test with mixed case and whitespace
          const result5 = isUserInRollout(
            `  ${userId.toUpperCase()}  `,
            `  ${configKey.toLowerCase()}  `,
            percentage,
          );

          // Property: All normalized inputs should produce the same result
          expect(result1).toBe(result2);
          expect(result1).toBe(result3);
          expect(result1).toBe(result4);
          expect(result1).toBe(result5);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 9 (Extended): Determinism across time
   * 
   * Tests that the same inputs produce the same result even when
   * evaluated at different times (no time-based randomness).
   */
  it('should return the same result across time (no time-based randomness)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 255 }), // userId
        fc.string({ minLength: 1, maxLength: 255 }), // configKey
        fc.integer({ min: 0, max: 100 }), // percentage
        async (userId: string, configKey: string, percentage: number) => {
          // First evaluation
          const result1 = isUserInRollout(userId, configKey, percentage);

          // Wait a small amount of time
          await new Promise((resolve) => setTimeout(resolve, 10));

          // Second evaluation after delay
          const result2 = isUserInRollout(userId, configKey, percentage);

          // Wait again
          await new Promise((resolve) => setTimeout(resolve, 10));

          // Third evaluation after another delay
          const result3 = isUserInRollout(userId, configKey, percentage);

          // Property: Results should be identical regardless of when evaluated
          expect(result1).toBe(result2);
          expect(result1).toBe(result3);
        },
      ),
      {
        numRuns: 50,
        verbose: true,
      },
    );
  });

  /**
   * Property 9 (Extended): Determinism with special characters
   * 
   * Tests that inputs with special characters (UTF-8) are handled
   * deterministically.
   */
  it('should handle special characters deterministically', () => {
    fc.assert(
      fc.property(
        fc.unicodeString({ minLength: 1, maxLength: 255 }), // userId with unicode
        fc.unicodeString({ minLength: 1, maxLength: 255 }), // configKey with unicode
        fc.integer({ min: 0, max: 100 }), // percentage
        (userId: string, configKey: string, percentage: number) => {
          // Multiple evaluations with special characters
          const result1 = isUserInRollout(userId, configKey, percentage);
          const result2 = isUserInRollout(userId, configKey, percentage);
          const result3 = isUserInRollout(userId, configKey, percentage);

          // Property: Results should be identical
          expect(result1).toBe(result2);
          expect(result1).toBe(result3);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 9 (Extended): Determinism for edge case percentages
   * 
   * Tests that 0% and 100% percentages are deterministic.
   */
  it('should be deterministic for edge case percentages (0% and 100%)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 255 }), // userId
        fc.string({ minLength: 1, maxLength: 255 }), // configKey
        (userId: string, configKey: string) => {
          // Test 0% rollout - should always be false
          const result0_1 = isUserInRollout(userId, configKey, 0);
          const result0_2 = isUserInRollout(userId, configKey, 0);
          const result0_3 = isUserInRollout(userId, configKey, 0);

          expect(result0_1).toBe(false);
          expect(result0_2).toBe(false);
          expect(result0_3).toBe(false);

          // Test 100% rollout - should always be true
          const result100_1 = isUserInRollout(userId, configKey, 100);
          const result100_2 = isUserInRollout(userId, configKey, 100);
          const result100_3 = isUserInRollout(userId, configKey, 100);

          expect(result100_1).toBe(true);
          expect(result100_2).toBe(true);
          expect(result100_3).toBe(true);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });
});
