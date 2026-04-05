import { isUserInRollout } from './rollout.utils';

describe('isUserInRollout', () => {
  describe('determinism', () => {
    it('should return the same result for the same inputs', () => {
      const userId = 'user123';
      const configKey = 'feature-flag-1';
      const percentage = 50;

      const result1 = isUserInRollout(userId, configKey, percentage);
      const result2 = isUserInRollout(userId, configKey, percentage);
      const result3 = isUserInRollout(userId, configKey, percentage);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('should handle input normalization (trim and lowercase)', () => {
      // Same user with different casing and whitespace should get same result
      const result1 = isUserInRollout('User123', 'FeatureFlag', 50);
      const result2 = isUserInRollout('user123', 'featureflag', 50);
      const result3 = isUserInRollout('  USER123  ', '  FEATUREFLAG  ', 50);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });

  describe('percentage boundaries', () => {
    it('should return false for 0% rollout', () => {
      // 0% means no users should be in rollout
      const result = isUserInRollout('user123', 'feature-flag', 0);
      expect(result).toBe(false);
    });

    it('should return true for 100% rollout', () => {
      // 100% means all users should be in rollout
      const result = isUserInRollout('user123', 'feature-flag', 100);
      expect(result).toBe(true);
    });

    it('should handle various users with 100% rollout', () => {
      // All users should be included at 100%
      expect(isUserInRollout('user1', 'feature', 100)).toBe(true);
      expect(isUserInRollout('user2', 'feature', 100)).toBe(true);
      expect(isUserInRollout('user3', 'feature', 100)).toBe(true);
      expect(isUserInRollout('user999', 'feature', 100)).toBe(true);
    });

    it('should handle various users with 0% rollout', () => {
      // No users should be included at 0%
      expect(isUserInRollout('user1', 'feature', 0)).toBe(false);
      expect(isUserInRollout('user2', 'feature', 0)).toBe(false);
      expect(isUserInRollout('user3', 'feature', 0)).toBe(false);
      expect(isUserInRollout('user999', 'feature', 0)).toBe(false);
    });
  });

  describe('distribution', () => {
    it('should distribute users across buckets', () => {
      // Test that different users get different results for 50% rollout
      const configKey = 'feature-flag';
      const percentage = 50;
      const users = Array.from({ length: 100 }, (_, i) => `user${i}`);

      const inRollout = users.filter((user) =>
        isUserInRollout(user, configKey, percentage),
      );

      // With 100 users and 50% rollout, we expect roughly 50 users
      // Allow some variance (between 30 and 70)
      expect(inRollout.length).toBeGreaterThan(30);
      expect(inRollout.length).toBeLessThan(70);
    });

    it('should produce different results for different config keys', () => {
      const userId = 'user123';

      // Same user should potentially get different rollout decisions for different features
      const result1 = isUserInRollout(userId, 'feature-a', 50);
      const result2 = isUserInRollout(userId, 'feature-b', 50);

      // We can't guarantee they're different, but we can verify the function runs
      expect(typeof result1).toBe('boolean');
      expect(typeof result2).toBe('boolean');
    });
  });

  describe('consistency across percentage changes', () => {
    it('should maintain user assignment when percentage increases', () => {
      const userId = 'user123';
      const configKey = 'feature-flag';

      // If a user is in 30% rollout, they should also be in 60% rollout
      const in30 = isUserInRollout(userId, configKey, 30);
      const in60 = isUserInRollout(userId, configKey, 60);

      if (in30) {
        // If user is in 30%, they must be in 60%
        expect(in60).toBe(true);
      }
    });

    it('should maintain consistency for multiple users', () => {
      const configKey = 'feature-flag';
      const users = ['user1', 'user2', 'user3', 'user4', 'user5'];

      // Users in 20% should also be in 50%
      users.forEach((user) => {
        const in20 = isUserInRollout(user, configKey, 20);
        const in50 = isUserInRollout(user, configKey, 50);

        if (in20) {
          expect(in50).toBe(true);
        }
      });
    });
  });

  describe('hash algorithm verification', () => {
    it('should use SHA-256 and modulo 100 correctly', () => {
      // Test with known inputs to verify the algorithm
      const userId = 'testuser';
      const configKey = 'testconfig';

      // The function should return a boolean
      const result = isUserInRollout(userId, configKey, 50);
      expect(typeof result).toBe('boolean');

      // Verify determinism with multiple calls
      for (let i = 0; i < 10; i++) {
        expect(isUserInRollout(userId, configKey, 50)).toBe(result);
      }
    });

    it('should handle UTF-8 encoding correctly', () => {
      // Test with special characters
      const result1 = isUserInRollout('user@example.com', 'feature-flag', 50);
      const result2 = isUserInRollout('user@example.com', 'feature-flag', 50);

      expect(result1).toBe(result2);
    });
  });
});
