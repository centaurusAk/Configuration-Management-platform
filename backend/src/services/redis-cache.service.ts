import { Injectable, Logger } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { CacheService } from './cache.service';

/**
 * Redis implementation of CacheService
 * 
 * Uses SCAN for production-safe pattern-based invalidation
 * Aligned with Requirements 6.1, 6.2, 6.3
 */
@Injectable()
export class RedisCacheService implements CacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: RedisClientType;

  constructor() {
    // Create Redis client
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    // Handle connection events
    this.client.on('error', (err) => {
      this.logger.error('Redis client error:', err);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis client connected');
    });

    // Connect to Redis
    this.connect();
  }

  private async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
    }
  }

  /**
   * Get a value from Redis cache
   * Requirement 6.2: Check cache before database
   */
  async get(key: string): Promise<any | null> {
    try {
      const value = await this.client.get(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value);
    } catch (error) {
      this.logger.error(`Failed to get cache key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in Redis cache with TTL
   * Requirement 6.3: Cache with 60-second TTL
   */
  async set(key: string, value: any, ttl: number): Promise<void> {
    try {
      // Don't cache undefined values
      if (value === undefined) {
        this.logger.warn(`Attempted to cache undefined value for key ${key}`);
        return;
      }
      await this.client.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      this.logger.error(`Failed to set cache key ${key}:`, error);
      // Cache write failure is non-fatal
    }
  }

  /**
   * Invalidate cache entries matching a pattern
   * Uses SCAN for production-safe iteration (Requirement 6.4, 6.5)
   * 
   * SCAN is safer than KEYS in production because:
   * - KEYS blocks the Redis server while scanning all keys
   * - SCAN iterates incrementally without blocking
   */
  async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await this.scanKeys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        this.logger.log(`Invalidated ${keys.length} cache entries matching ${pattern}`);
      }
    } catch (error) {
      this.logger.error(`Failed to invalidate pattern ${pattern}:`, error);
    }
  }

  /**
   * Invalidate all cache entries for a specific config
   * Requirement 6.4: Invalidate cache on config update
   */
  async invalidateConfig(
    orgId: string,
    projectId: string,
    envId: string,
    keyName: string
  ): Promise<void> {
    // Invalidate all context variations for this config
    // Format: config:{org_id}:{project_id}:{env_id}:{key_name}:*
    const pattern = `config:${orgId}:${projectId}:${envId}:${keyName}:*`;
    await this.invalidate(pattern);
  }

  /**
   * Scan for keys matching a pattern using SCAN command
   * This is production-safe as it doesn't block the Redis server
   * 
   * @param pattern Pattern to match (supports * wildcard)
   * @returns Array of matching keys
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = 0;

    do {
      try {
        // SCAN returns cursor and keys
        const result = await this.client.scan(cursor, {
          MATCH: pattern,
          COUNT: 100, // Scan 100 keys per iteration
        });

        cursor = result.cursor;
        keys.push(...result.keys);
      } catch (error) {
        this.logger.error(`Failed to scan keys with pattern ${pattern}:`, error);
        break;
      }
    } while (cursor !== 0);

    return keys;
  }

  /**
   * Close the Redis connection
   * Should be called on application shutdown
   */
  async close(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.log('Redis client disconnected');
    } catch (error) {
      this.logger.error('Failed to close Redis client:', error);
    }
  }
}
