import { createHash } from 'crypto';

/**
 * Deterministic hashing function for percentage rollout
 * 
 * Requirements:
 * - 3.1: Use deterministic hashing of user ID to assign users consistently
 * - 3.2: hash(user_id + config_key) mod 100 < percentage
 * 
 * Key Design Decisions:
 * - SHA-256: Cryptographically secure, deterministic, available in all languages
 * - Normalization: Trim and lowercase to handle input variations
 * - UTF-8 encoding: Explicit encoding for cross-language consistency
 * - First 4 bytes: Sufficient entropy for percentage bucketing
 * - Modulo 100: Direct mapping to percentage (0-100)
 * 
 * @param userId - The user identifier to hash
 * @param configKey - The configuration key name
 * @param percentage - The rollout percentage (0-100)
 * @returns true if the user is in the rollout percentage, false otherwise
 */
export function isUserInRollout(
  userId: string,
  configKey: string,
  percentage: number,
): boolean {
  // Requirement 3.2: hash(user_id + config_key) mod 100 < percentage

  // 1. Normalize inputs for cross-language determinism
  const normalizedUserId = userId.trim().toLowerCase();
  const normalizedConfigKey = configKey.trim().toLowerCase();

  // 2. Concatenate user_id + config_key
  const input = normalizedUserId + normalizedConfigKey;

  // 3. Hash using SHA-256 (widely available, deterministic)
  const hash = createHash('sha256').update(input, 'utf8').digest();

  // 4. Convert first 4 bytes to unsigned 32-bit integer
  const hashValue = hash.readUInt32BE(0);

  // 5. Modulo 100 to get bucket (0-99)
  const bucket = hashValue % 100;

  // 6. Check if bucket is less than percentage threshold
  return bucket < percentage;
}
