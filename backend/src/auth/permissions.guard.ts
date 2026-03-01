import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, hasPermission } from './permissions';
import { PERMISSIONS_KEY } from './require-permission.decorator';

/**
 * Guard that checks if the authenticated user has required permissions
 * Requirements 7.2, 7.3, 7.4, 7.5
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required permissions from decorator metadata
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions are required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Get user from request (set by JWT strategy)
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every((permission) =>
      hasPermission(user.role, permission),
    );

    if (!hasAllPermissions) {
      // Requirement 7.5: Return 403 Forbidden when user lacks permission
      throw new ForbiddenException(
        `User with role '${user.role}' does not have required permissions`,
      );
    }

    return true;
  }
}
