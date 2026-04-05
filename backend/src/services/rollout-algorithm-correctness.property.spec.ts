import * as fc from 'fast-check';
import { isUserInRollout } from './rollout.utils';
import { createHash } from 'crypto';

/**
 * Property-Based Tests for Percentage Rollout Algorithm Correctness
 * 
 * **Validates: Requirements 3.2, 3.3**
 * 
 * Property 10: Percentage rollout algorithm correctness
 * For any user ID and config key, the rollout decision should match the formula:
 * hash(normalize(user_id) + normalize(config_key)) mod 100 < percentage,
 * where normalize means trim and lowercase, and hash uses SHA-256 with first 4 bytes as uint32.
 */
describe('Property Test: Percentage Rollout Algorithm Correctness', () => {
  /**
   * Helper function to compute the expected bucket for a user/config pair
   * This replicates the algorithm logic to verify correctness
   */
  function computeExpectedBucket(userId: string, configKey: string): number {
    const normalizedUserId = userId.trim().toLowerCase();
    const normalizedConfigKey = configKey.trim().toLowerCase();
    const input = normalizedUserId + normalizedConfigKey;
    const hash = createHash('sha256').update(input, 'utf8').digest();
    const hashValue = hash.readUInt32BE(0);
    return hashValue % 100;
  }

  /**
   * Property 10: Algorithm matches specification formula
   * 
   * Tests that the rollout decision matches the exact formula specified:
   * hash(normalize(user_id) + normalize(config_key)) mod 100 < percentage
   */
  it('should match the specification formula: hash(normalize(user_id) + normalize(config_key)) mod 100 < percentage', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 255 }), // userId
        fc.string({ minLength: 1, maxLength: 255 }), // configKey
        fc.integer({ min: 0, max: 100 }), // percentage
        (userId: string, configKey: string, percentage: number) => {
          // Compute the expected bucket using the specification formula
          const bucket = computeExpectedBucket(userId, configKey);

          // Get the actual result from the implementation
          const actualResult = isUserInRollout(userId, configKey, percentage);

          // Expected result based on the formula
          const expectedResult = bucket < percentage;

          // Property: Implementation should match the specification
          expect(actualResult).toBe(expectedResult);
        },
      ),
      {
        numRuns: 200,
        verbose: true,
      },
    );
  });

  /**
   * Property 10 (Extended): Percentage distribution correctness
   * 
   * Tests that over a large sample of users, approximately the correct
   * percentage of users are included in the rollout.
   */
  it('should distribute users according to the specified percentage (statistical test)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // percentage
        fc.constant('test-config-key'), // fixed config key for consistency
        (percentage: number, configKey: string) => {
          // Generate a sample of 1000 users
          const sampleSize = 1000;
          const userIds = Array.from({ length: sampleSize }, (_, i) => `user-${i}`);

          // Count how many users are in the rollout
          const usersInRollout = userIds.filter((userId) =>
            isUserInRollout(userId, configKey, percentage),
          ).length;

          // Calculate the actual percentage
          const actualPercentage = (usersInRollout / sampleSize) * 100;

          // Property: Actual percentage should be within ±5% of target
          // (allowing for statistical variance with 1000 samples)
          const tolerance = 5;
          const lowerBound = Math.max(0, percentage - tolerance);
          const upperBound = Math.min(100, percentage + tolerance);

          expect(actualPercentage).toBeGreaterThanOrEqual(lowerBound);
          expect(actualPercentage).toBeLessThanOrEqual(upperBound);
        },
      ),
      {
        numRuns: 50,
        verbose: true,
      },
    );
  });

  /**
   * Property 10 (Extended): Monotonicity property
   * 
   * Tests that users in lower percentages are also in higher percentages.
   * If a user is in a 30% rollout, they should also be in a 50% rollout.
   * This is a critical property for gradual rollouts.
   */
  it('should maintain monotonicity: users in lower percentages are also in higher percentages', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 255 }), // userId
        fc.string({ minLength: 1, maxLength: 255 }), // configKey
        fc.integer({ min: 0, max: 99 }), // lowerPercentage (0-99 to ensure we can test higher)
        (userId: string, configKey: string, lowerPercentage: number) => {
          const higherPercentage = lowerPercentage + 1;

          const inLowerRollout = isUserInRollout(userId, configKey, lowerPercentage);
          const inHigherRollout = isUserInRollout(userId, configKey, higherPercentage);

          // Property: If user is in lower percentage, they MUST be in higher percentage
          if (inLowerRollout) {
            expect(inHigherRollout).toBe(true);
          }

          // Additional check: Higher percentage should include at least as many users
          // This is implicitly tested by the above, but we can verify the logic
          // by checking that if NOT in lower, we can be in either state for higher
          if (!inLowerRollout) {
            // No constraint - can be true or false
            expect(typeof inHigherRollout).toBe('boolean');
          }
        },
      ),
      {
        numRuns: 200,
        verbose: true,
      },
    );
  });

  /**
   * Property 10 (Extended): Boundary conditions
   * 
   * Tests that 0% includes no users and 100% includes all users.
   */
  it('should handle boundary conditions correctly: 0% includes no users, 100% includes all users', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 255 }), // userId
        fc.string({ minLength: 1, maxLength: 255 }), // configKey
        (userId: string, configKey: string) => {
          // Property: 0% should never include any user
          const result0 = isUserInRollout(userId, configKey, 0);
          expect(result0).toBe(false);

          // Property: 100% should always include every user
          const result100 = isUserInRollout(userId, configKey, 100);
          expect(result100).toBe(true);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 10 (Extended): Bucket range validation
   * 
   * Tests that the computed bucket is always in the range [0, 99].
   */
  it('should always compute buckets in the range [0, 99]', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 255 }), // userId
        fc.string({ minLength: 1, maxLength: 255 }), // configKey
        (userId: string, configKey: string) => {
          const bucket = computeExpectedBucket(userId, configKey);

          // Property: Bucket should be in valid range
          expect(bucket).toBeGreaterThanOrEqual(0);
          expect(bucket).toBeLessThanOrEqual(99);
        },
      ),
      {
        numRuns: 200,
        verbose: true,
      },
    );
  });

  /**
   * Property 10 (Extended): Different users get different buckets
   * 
   * Tests that the hash function provides good distribution by verifying
   * that different users typically get different buckets.
   */
  it('should distribute different users across different buckets (collision test)', () => {
    fc.assert(
      fc.property(
        fc.constant('test-config-key'), // fixed config key
        (configKey: string) => {
          // Generate 100 different users
          const userIds = Array.from({ length: 100 }, (_, i) => `user-${i}`);

          // Compute buckets for all users
          const buckets = userIds.map((userId) => computeExpectedBucket(userId, configKey));

          // Count unique buckets
          const uniqueBuckets = new Set(buckets).size;

          // Property: Should have good distribution (at least 50% unique buckets)
          // With 100 users and 100 possible buckets, we expect high uniqueness
          expect(uniqueBuckets).toBeGreaterThanOrEqual(50);
        },
      ),
      {
        numRuns: 20,
        verbose: true,
      },
    );
  });

  /**
   * Property 10 (Extended): Same user, different configs get different buckets
   * 
   * Tests that the same user gets different rollout decisions for different
   * config keys, ensuring independence between features.
   */
  it('should assign different buckets for the same user across different config keys', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 255 }), // userId
        (userId: string) => {
          // Generate multiple different config keys
          const configKeys = Array.from({ length: 50 }, (_, i) => `config-${i}`);

          // Compute buckets for the same user across different configs
          const buckets = configKeys.map((configKey) =>
            computeExpectedBucket(userId, configKey),
          );

          // Count unique buckets
          const uniqueBuckets = new Set(buckets).size;

          // Property: Should have good distribution across configs
          // With 50 configs, expect at least 25 unique buckets (50% uniqueness)
          expect(uniqueBuckets).toBeGreaterThanOrEqual(25);
        },
      ),
      {
        numRuns: 20,
        verbose: true,
      },
    );
  });

  /**
   * Property 10 (Extended): Normalization consistency
   * 
   * Tests that the normalization (trim + lowercase) is applied correctly
   * and consistently affects the bucket calculation.
   */
  it('should apply normalization consistently in bucket calculation', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 255 }), // userId
        fc.string({ minLength: 1, maxLength: 255 }), // configKey
        (userId: string, configKey: string) => {
          // Compute bucket with original inputs
          const bucket1 = computeExpectedBucket(userId, configKey);

          // Compute bucket with pre-normalized inputs
          const normalizedUserId = userId.trim().toLowerCase();
          const normalizedConfigKey = configKey.trim().toLowerCase();
          const bucket2 = computeExpectedBucket(normalizedUserId, normalizedConfigKey);

          // Compute bucket with various denormalized versions
          const bucket3 = computeExpectedBucket(
            `  ${userId.toUpperCase()}  `,
            `  ${configKey.toUpperCase()}  `,
          );

          // Property: All should produce the same bucket
          expect(bucket1).toBe(bucket2);
          expect(bucket1).toBe(bucket3);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });
});
