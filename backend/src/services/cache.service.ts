/**
 * Cache Service Interface
 * 
 * Provides caching operations for configuration values.
 * Aligned with Requirements 6.1, 6.2, 6.3
 */

export interface CacheService {
  /**
   * Get a value from cache
   * @param key Cache key
   * @returns Cached value or null if not found
   */
  get(key: string): Promise<any | null>;

  /**
   * Set a value in cache with TTL
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time to live in seconds
   */
  set(key: string, value: any, ttl: number): Promise<void>;

  /**
   * Invalidate cache entries matching a pattern
   * @param pattern Pattern to match (supports wildcards)
   */
  invalidate(pattern: string): Promise<void>;

  /**
   * Invalidate all cache entries for a specific config
   * @param orgId Organization ID
   * @param projectId Project ID
   * @param envId Environment ID
   * @param keyName Config key name
   */
  invalidateConfig(
    orgId: string,
    projectId: string,
    envId: string,
    keyName: string
  ): Promise<void>;

  /**
   * Close the cache connection
   * Should be called on application shutdown
   */
  close(): Promise<void>;
}

import * as crypto from 'crypto';
import { Context } from '../types/models';

/**
 * Build a cache key following the format:
 * config:{org_id}:{project_id}:{env_id}:{key_name}:{context_hash}
 * 
 * Aligned with Requirement 6.6
 * 
 * @param orgId Organization ID
 * @param projectId Project ID
 * @param envId Environment ID
 * @param keyName Configuration key name
 * @param context User/request context for rule evaluation
 * @returns Formatted cache key
 */
export function buildCacheKey(
  orgId: string,
  projectId: string,
  envId: string,
  keyName: string,
  context: Context
): string {
  const contextHash = hashContext(context);
  return `config:${orgId}:${projectId}:${envId}:${keyName}:${contextHash}`;
}

/**
 * Hash context deterministically for cache key generation
 * 
 * Sorts context keys alphabetically to ensure deterministic hashing
 * regardless of key insertion order.
 * 
 * @param context User/request context
 * @returns Hex-encoded hash (first 16 characters for manageable key length)
 */
export function hashContext(context: Context): string {
  // Sort keys for deterministic hashing
  const sortedKeys = Object.keys(context).sort();
  
  // Build normalized string representation
  const normalized = sortedKeys
    .map(key => {
      const value = context[key as keyof Context];
      // Handle nested objects (custom_attributes)
      if (typeof value === 'object' && value !== null) {
        return `${key}=${JSON.stringify(value)}`;
      }
      return `${key}=${value}`;
    })
    .join('&');
  
  // Hash to keep key length manageable
  return crypto
    .createHash('sha256')
    .update(normalized, 'utf8')
    .digest('hex')
    .substring(0, 16);
}
