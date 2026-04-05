/**
 * Health Check Controller
 * 
 * Provides health check endpoints to verify system component availability.
 * Returns status: healthy or degraded based on PostgreSQL and Redis connectivity.
 * 
 * Requirement 9.6: Health check endpoints
 */

import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inject } from '@nestjs/common';
import { ConfigKey } from '../entities/config-key.entity';
import { CacheService } from '../services/cache.service';

export interface ServiceHealth {
  healthy: boolean;
  latency?: number;
  error?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded';
  timestamp: Date;
  services: {
    postgres: ServiceHealth;
    redis: ServiceHealth;
  };
}

@Controller('health')
export class HealthController {
  constructor(
    @InjectRepository(ConfigKey)
    private readonly configKeyRepository: Repository<ConfigKey>,
    @Inject('CacheService')
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Health check endpoint
   * 
   * GET /health
   * 
   * Returns:
   * - status: 'healthy' if all services are up, 'degraded' if any service is down
   * - timestamp: Current server time
   * - services: Health status of each service (PostgreSQL, Redis)
   * 
   * Requirement 9.6: Expose health check endpoints
   */
  @Get()
  async check(): Promise<HealthStatus> {
    const postgres = await this.checkPostgres();
    const redis = await this.checkRedis();

    return {
      status: postgres.healthy && redis.healthy ? 'healthy' : 'degraded',
      timestamp: new Date(),
      services: {
        postgres,
        redis,
      },
    };
  }

  /**
   * Check PostgreSQL connectivity
   */
  private async checkPostgres(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      // Simple query to check database connectivity
      await this.configKeyRepository.query('SELECT 1');
      const latency = Date.now() - startTime;
      return { healthy: true, latency };
    } catch (error) {
      return { 
        healthy: false, 
        error: error.message || 'Database connection failed' 
      };
    }
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedis(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      // Try to set and get a test value
      const testKey = 'health:check:test';
      const testValue = 'ok';
      
      await this.cacheService.set(testKey, testValue, 5);
      const retrieved = await this.cacheService.get(testKey);
      
      if (retrieved !== testValue) {
        throw new Error('Cache value mismatch');
      }
      
      const latency = Date.now() - startTime;
      return { healthy: true, latency };
    } catch (error) {
      return { 
        healthy: false, 
        error: error.message || 'Redis connection failed' 
      };
    }
  }
}
