import { SDKConfig, Context } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ConfigClient {
  private cache: Map<string, any> = new Map();
  private context: Context;
  private refreshTimer: NodeJS.Timeout | null = null;
  private initialized: boolean = false;
  private diskCache: DiskCache | null = null;

  constructor(private config: SDKConfig, context: Context = {}) {
    this.context = context;
    
    // Initialize disk cache if path provided
    if (config.diskCachePath) {
      this.diskCache = new DiskCache(config.diskCachePath);
    }
  }

  /**
   * Initialize the SDK by loading cache from disk and fetching configs
   * Requirements: 5.2, 12.3
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Load cache from disk if available
    if (this.diskCache) {
      try {
        const diskData = await this.diskCache.load();
        if (diskData) {
          this.cache = new Map(Object.entries(diskData));
        }
      } catch (error) {
        // Disk cache load failed, continue without it
        console.warn('Failed to load disk cache:', error);
      }
    }

    // Fetch fresh configs from backend
    await this.refresh();

    // Start automatic refresh timer
    const interval = this.config.refreshInterval || 30000; // Default 30 seconds
    this.refreshTimer = setInterval(() => {
      this.refresh().catch(err => {
        console.error('Auto-refresh failed:', err);
      });
    }, interval);

    this.initialized = true;
  }

  /**
   * Get configuration value with context
   * Requirements: 5.1, 5.5, 5.6
   */
  async get<T>(key: string, defaultValue: T): Promise<T> {
    // Return cached value if available
    const value = this.cache.get(key);
    
    if (value === undefined) {
      return defaultValue;
    }
    
    return value as T;
  }

  /**
   * Get all cached configurations
   * Requirements: 5.2
   */
  getAll(): Record<string, any> {
    return Object.fromEntries(this.cache.entries());
  }

  /**
   * Manually refresh configurations from backend
   * Requirements: 5.4
   */
  async refresh(): Promise<void> {
    try {
      const response = await fetch(
        `${this.config.apiUrl}/api/v1/sdk/configs`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            projectId: this.config.projectId,
            environmentId: this.config.environmentId,
            context: this.context,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { configs?: Record<string, any> };
      
      // Update cache with fetched configs
      if (data.configs) {
        this.cache.clear();
        Object.entries(data.configs).forEach(([key, value]) => {
          this.cache.set(key, value);
        });

        // Persist to disk if enabled
        if (this.diskCache) {
          try {
            await this.diskCache.save(data.configs);
          } catch (error) {
            console.warn('Failed to save disk cache:', error);
          }
        }
      }
    } catch (error) {
      // Network error - continue serving from cache
      // Requirements: 5.5, 12.1, 12.5
      console.warn('Failed to refresh configs, serving from cache:', error);
    }
  }

  /**
   * Update context for rule evaluation
   */
  setContext(context: Context): void {
    this.context = context;
  }

  /**
   * Clean up resources
   */
  close(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

/**
 * Disk cache implementation for offline-first design
 * Requirements: 12.2, 12.3, 12.4
 */
class DiskCache {
  constructor(private cachePath: string) {}

  async load(): Promise<Record<string, any> | null> {
    try {
      const data = await fs.readFile(this.cachePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is invalid
      return null;
    }
  }

  async save(configs: Record<string, any>): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.cachePath);
      await fs.mkdir(dir, { recursive: true });
      
      // Write cache file
      await fs.writeFile(this.cachePath, JSON.stringify(configs, null, 2), 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save disk cache: ${error}`);
    }
  }
}
