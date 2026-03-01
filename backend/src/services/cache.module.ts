import { Module } from '@nestjs/common';
import { RedisCacheService } from './redis-cache.service';

/**
 * Cache Module
 * 
 * Provides caching services for the application
 */
@Module({
  providers: [
    {
      provide: 'CacheService',
      useClass: RedisCacheService,
    },
  ],
  exports: ['CacheService'],
})
export class CacheModule {}
