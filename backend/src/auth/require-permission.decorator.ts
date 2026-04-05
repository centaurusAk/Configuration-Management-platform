import { SetMetadata } from '@nestjs/common';
import { Permission } from './permissions';

/**
 * Metadata key for storing required permissions
 */
export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to specify required permissions for a route or controller
 * 
 * Usage:
 * @RequirePermission(Permission.WRITE_CONFIG)
 * async updateConfig() { ... }
 * 
 * @RequirePermission(Permission.WRITE_CONFIG, Permission.DELETE_CONFIG)
 * async deleteConfig() { ... }
 * 
 * Requirements 7.2, 7.3, 7.4, 7.5
 */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
