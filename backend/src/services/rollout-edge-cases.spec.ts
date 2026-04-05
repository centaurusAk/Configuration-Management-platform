import { isUserInRollout } from './rollout.utils';

/**
 * Unit Tests for Percentage Rollout Edge Cases
 * 
 * **Validates: Requirement 3.4**
 * 
 * Task 6.4: Write unit tests for percentage edge cases
 * - Test 0% rollout (no users)
 * - Test 100% rollout (all users)
 * - Test boundary conditions
 * 
 * These tests complement the property-based tests by focusing on specific
 * edge cases and boundary conditions that are critical for correctness.
 */
describe('Percentage Rollout Edge Cases', () => {
  describe('0% rollout edge cases', () => {
    it('should exclude all users at 0% rollout', () => {
      // Test a variety of user IDs to ensure 0% truly means no users
      const userIds = [
        'user1',
        'user2',
        'user3',
        'admin',
        'test@example.com',
        '12345',
        'user-with-dashes',
        'user_with_underscores',
        'UPPERCASE',
        'MixedCase',
        '   whitespace   ',
        'special!@#$%',
        'unicode-用户',
        '',
      ];

      const configKey = 'test-feature';

      userIds.forEach((userId) => {
        if (userId.trim()) {
          // Skip empty string
          const result = isUserInRollout(userId, configKey, 0);
          expect(result).toBe(false);
        }
      });
    });

    it('should exclude users at 0% regardless of config key', () => {
      const userId = 'test-user';
      const configKeys = [
        'feature-a',
        'feature-b',
        'feature-c',
        'very-long-config-key-name-with-many-characters',
        'short',
        'UPPERCASE-KEY',
        'key-with-numbers-123',
      ];

      configKeys.forEach((configKey) => {
        const result = isUserInRollout(userId, configKey, 0);
        expect(result).toBe(false);
      });
    });

    it('should handle 0% with normalized inputs', () => {
      // Test that normalization doesn't affect 0% behavior
      const testCases = [
        { userId: 'User', configKey: 'Feature', percentage: 0 },
        { userId: 'USER', configKey: 'FEATURE', percentage: 0 },
        { userId: '  user  ', configKey: '  feature  ', percentage: 0 },
        { userId: 'UsEr', configKey: 'FeAtUrE', percentage: 0 },
      ];

      testCases.forEach(({ userId, configKey, percentage }) => {
        const result = isUserInRollout(userId, configKey, percentage);
        expect(result).toBe(false);
      });
    });
  });

  describe('100% rollout edge cases', () => {
    it('should include all users at 100% rollout', () => {
      // Test a variety of user IDs to ensure 100% truly means all users
      const userIds = [
        'user1',
        'user2',
        'user3',
        'admin',
        'test@example.com',
        '12345',
        'user-with-dashes',
        'user_with_underscores',
        'UPPERCASE',
        'MixedCase',
        '   whitespace   ',
        'special!@#$%',
        'unicode-用户',
      ];

      const configKey = 'test-feature';

      userIds.forEach((userId) => {
        const result = isUserInRollout(userId, configKey, 100);
        expect(result).toBe(true);
      });
    });

    it('should include users at 100% regardless of config key', () => {
      const userId = 'test-user';
      const configKeys = [
        'feature-a',
        'feature-b',
        'feature-c',
        'very-long-config-key-name-with-many-characters',
        'short',
        'UPPERCASE-KEY',
        'key-with-numbers-123',
      ];

      configKeys.forEach((configKey) => {
        const result = isUserInRollout(userId, configKey, 100);
        expect(result).toBe(true);
      });
    });

    it('should handle 100% with normalized inputs', () => {
      // Test that normalization doesn't affect 100% behavior
      const testCases = [
        { userId: 'User', configKey: 'Feature', percentage: 100 },
        { userId: 'USER', configKey: 'FEATURE', percentage: 100 },
        { userId: '  user  ', configKey: '  feature  ', percentage: 100 },
        { userId: 'UsEr', configKey: 'FeAtUrE', percentage: 100 },
      ];

      testCases.forEach(({ userId, configKey, percentage }) => {
        const result = isUserInRollout(userId, configKey, percentage);
        expect(result).toBe(true);
      });
    });

    it('should include users with extreme hash values at 100%', () => {
      // Test users that might hash to edge buckets (0 or 99)
      // We can't predict exact hashes, but 100% should include them all
      const edgeCaseUsers = [
        'a',
        'z',
        '0',
        '9',
        'aaa',
        'zzz',
        '000',
        '999',
      ];

      const configKey = 'test-feature';

      edgeCaseUsers.forEach((userId) => {
        const result = isUserInRollout(userId, configKey, 100);
        expect(result).toBe(true);
      });
    });
  });

  describe('boundary percentage values', () => {
    it('should handle 1% rollout (minimal inclusion)', () => {
      // At 1%, only users hashing to bucket 0 should be included
      const configKey = 'test-feature';
      const sampleSize = 1000;
      const userIds = Array.from({ length: sampleSize }, (_, i) => `user-${i}`);

      const includedUsers = userIds.filter((userId) =>
        isUserInRollout(userId, configKey, 1),
      );

      // With 1%, we expect roughly 1% of users (10 out of 1000)
      // Allow variance: between 0 and 30 users (3%)
      expect(includedUsers.length).toBeGreaterThanOrEqual(0);
      expect(includedUsers.length).toBeLessThanOrEqual(30);
    });

    it('should handle 99% rollout (maximal inclusion)', () => {
      // At 99%, only users hashing to bucket 99 should be excluded
      const configKey = 'test-feature';
      const sampleSize = 1000;
      const userIds = Array.from({ length: sampleSize }, (_, i) => `user-${i}`);

      const includedUsers = userIds.filter((userId) =>
        isUserInRollout(userId, configKey, 99),
      );

      // With 99%, we expect roughly 99% of users (990 out of 1000)
      // Allow variance: between 970 and 1000 users
      expect(includedUsers.length).toBeGreaterThanOrEqual(970);
      expect(includedUsers.length).toBeLessThanOrEqual(1000);
    });

    it('should handle transition from 0% to 1%', () => {
      const userId = 'test-user';
      const configKey = 'test-feature';

      const at0 = isUserInRollout(userId, configKey, 0);
      const at1 = isUserInRollout(userId, configKey, 1);

      // At 0%, user should not be included
      expect(at0).toBe(false);

      // At 1%, user might or might not be included (depends on hash)
      expect(typeof at1).toBe('boolean');

      // If user is in 1%, they should also be in higher percentages
      if (at1) {
        expect(isUserInRollout(userId, configKey, 50)).toBe(true);
        expect(isUserInRollout(userId, configKey, 100)).toBe(true);
      }
    });

    it('should handle transition from 99% to 100%', () => {
      const userId = 'test-user';
      const configKey = 'test-feature';

      const at99 = isUserInRollout(userId, configKey, 99);
      const at100 = isUserInRollout(userId, configKey, 100);

      // At 100%, user should always be included
      expect(at100).toBe(true);

      // At 99%, user might or might not be included (depends on hash)
      expect(typeof at99).toBe('boolean');

      // If user is NOT in 99%, they should still be in 100%
      if (!at99) {
        expect(at100).toBe(true);
      }
    });
  });

  describe('bucket boundary conditions', () => {
    it('should correctly handle users hashing to bucket 0', () => {
      // Find a user that hashes to bucket 0
      const configKey = 'test-feature';
      let bucket0User: string | null = null;

      // Try to find a user that hashes to bucket 0
      for (let i = 0; i < 10000; i++) {
        const userId = `user-${i}`;
        // User is in bucket 0 if they're in 1% but not in 0%
        if (isUserInRollout(userId, configKey, 1) && !isUserInRollout(userId, configKey, 0)) {
          bucket0User = userId;
          break;
        }
      }

      if (bucket0User) {
        // Bucket 0 user should be included in 1% and above
        expect(isUserInRollout(bucket0User, configKey, 0)).toBe(false);
        expect(isUserInRollout(bucket0User, configKey, 1)).toBe(true);
        expect(isUserInRollout(bucket0User, configKey, 50)).toBe(true);
        expect(isUserInRollout(bucket0User, configKey, 100)).toBe(true);
      }
    });

    it('should correctly handle users hashing to bucket 99', () => {
      // Find a user that hashes to bucket 99
      const configKey = 'test-feature';
      let bucket99User: string | null = null;

      // Try to find a user that hashes to bucket 99
      for (let i = 0; i < 10000; i++) {
        const userId = `user-${i}`;
        // User is in bucket 99 if they're in 100% but not in 99%
        if (isUserInRollout(userId, configKey, 100) && !isUserInRollout(userId, configKey, 99)) {
          bucket99User = userId;
          break;
        }
      }

      if (bucket99User) {
        // Bucket 99 user should only be included in 100%
        expect(isUserInRollout(bucket99User, configKey, 0)).toBe(false);
        expect(isUserInRollout(bucket99User, configKey, 50)).toBe(false);
        expect(isUserInRollout(bucket99User, configKey, 99)).toBe(false);
        expect(isUserInRollout(bucket99User, configKey, 100)).toBe(true);
      }
    });

    it('should handle percentage at exact bucket boundaries', () => {
      const configKey = 'test-feature';

      // Test multiple users at various percentage boundaries
      const percentages = [1, 10, 25, 50, 75, 90, 99];
      const userIds = Array.from({ length: 100 }, (_, i) => `user-${i}`);

      percentages.forEach((percentage) => {
        const includedUsers = userIds.filter((userId) =>
          isUserInRollout(userId, configKey, percentage),
        );

        // Verify that the number of included users is reasonable
        // Allow ±20% variance from expected percentage
        const expectedCount = percentage;
        const minCount = Math.max(0, expectedCount - 20);
        const maxCount = Math.min(100, expectedCount + 20);

        expect(includedUsers.length).toBeGreaterThanOrEqual(minCount);
        expect(includedUsers.length).toBeLessThanOrEqual(maxCount);
      });
    });
  });

  describe('monotonicity at boundaries', () => {
    it('should maintain monotonicity from 0% to 1%', () => {
      const configKey = 'test-feature';
      const userIds = Array.from({ length: 100 }, (_, i) => `user-${i}`);

      userIds.forEach((userId) => {
        const at0 = isUserInRollout(userId, configKey, 0);
        const at1 = isUserInRollout(userId, configKey, 1);

        // If in 0%, must be in 1% (but 0% should always be false)
        if (at0) {
          expect(at1).toBe(true);
        }

        // 0% should always be false
        expect(at0).toBe(false);
      });
    });

    it('should maintain monotonicity from 99% to 100%', () => {
      const configKey = 'test-feature';
      const userIds = Array.from({ length: 100 }, (_, i) => `user-${i}`);

      userIds.forEach((userId) => {
        const at99 = isUserInRollout(userId, configKey, 99);
        const at100 = isUserInRollout(userId, configKey, 100);

        // If in 99%, must be in 100%
        if (at99) {
          expect(at100).toBe(true);
        }

        // 100% should always be true
        expect(at100).toBe(true);
      });
    });

    it('should maintain monotonicity across all boundary transitions', () => {
      const configKey = 'test-feature';
      const userId = 'test-user';

      // Test all adjacent percentage pairs
      for (let p = 0; p < 100; p++) {
        const atP = isUserInRollout(userId, configKey, p);
        const atPPlus1 = isUserInRollout(userId, configKey, p + 1);

        // If in p%, must be in (p+1)%
        if (atP) {
          expect(atPPlus1).toBe(true);
        }
      }
    });
  });

  describe('special input edge cases', () => {
    it('should handle very long user IDs at boundary percentages', () => {
      const longUserId = 'a'.repeat(1000);
      const configKey = 'test-feature';

      expect(isUserInRollout(longUserId, configKey, 0)).toBe(false);
      expect(isUserInRollout(longUserId, configKey, 100)).toBe(true);
      expect(typeof isUserInRollout(longUserId, configKey, 50)).toBe('boolean');
    });

    it('should handle very long config keys at boundary percentages', () => {
      const userId = 'test-user';
      const longConfigKey = 'feature-'.repeat(100);

      expect(isUserInRollout(userId, longConfigKey, 0)).toBe(false);
      expect(isUserInRollout(userId, longConfigKey, 100)).toBe(true);
      expect(typeof isUserInRollout(userId, longConfigKey, 50)).toBe('boolean');
    });

    it('should handle single character inputs at boundary percentages', () => {
      const singleCharUsers = ['a', 'b', 'z', '1', '9', '@', '#'];
      const singleCharKeys = ['x', 'y', 'z', '0', '9'];

      singleCharUsers.forEach((userId) => {
        singleCharKeys.forEach((configKey) => {
          expect(isUserInRollout(userId, configKey, 0)).toBe(false);
          expect(isUserInRollout(userId, configKey, 100)).toBe(true);
        });
      });
    });

    it('should handle numeric string user IDs at boundary percentages', () => {
      const numericUserIds = ['0', '1', '999', '123456789', '00000'];
      const configKey = 'test-feature';

      numericUserIds.forEach((userId) => {
        expect(isUserInRollout(userId, configKey, 0)).toBe(false);
        expect(isUserInRollout(userId, configKey, 100)).toBe(true);
      });
    });

    it('should handle email-like user IDs at boundary percentages', () => {
      const emailUserIds = [
        'user@example.com',
        'test.user@domain.co.uk',
        'admin+tag@site.org',
      ];
      const configKey = 'test-feature';

      emailUserIds.forEach((userId) => {
        expect(isUserInRollout(userId, configKey, 0)).toBe(false);
        expect(isUserInRollout(userId, configKey, 100)).toBe(true);
      });
    });
  });

  describe('consistency verification at boundaries', () => {
    it('should be consistent at 0% across multiple calls', () => {
      const userId = 'test-user';
      const configKey = 'test-feature';

      const results = Array.from({ length: 100 }, () =>
        isUserInRollout(userId, configKey, 0),
      );

      // All results should be false
      expect(results.every((r) => r === false)).toBe(true);
    });

    it('should be consistent at 100% across multiple calls', () => {
      const userId = 'test-user';
      const configKey = 'test-feature';

      const results = Array.from({ length: 100 }, () =>
        isUserInRollout(userId, configKey, 100),
      );

      // All results should be true
      expect(results.every((r) => r === true)).toBe(true);
    });

    it('should be consistent at 1% across multiple calls', () => {
      const userId = 'test-user';
      const configKey = 'test-feature';

      const result1 = isUserInRollout(userId, configKey, 1);
      const results = Array.from({ length: 100 }, () =>
        isUserInRollout(userId, configKey, 1),
      );

      // All results should match the first result
      expect(results.every((r) => r === result1)).toBe(true);
    });

    it('should be consistent at 99% across multiple calls', () => {
      const userId = 'test-user';
      const configKey = 'test-feature';

      const result1 = isUserInRollout(userId, configKey, 99);
      const results = Array.from({ length: 100 }, () =>
        isUserInRollout(userId, configKey, 99),
      );

      // All results should match the first result
      expect(results.every((r) => r === result1)).toBe(true);
    });
  });
});
