/**
 * Permission enum for RBAC
 * Requirements 7.2, 7.3, 7.4, 7.5
 */
export enum Permission {
  READ_CONFIG = 'read:config',
  WRITE_CONFIG = 'write:config',
  DELETE_CONFIG = 'delete:config',
  READ_AUDIT = 'read:audit',
  MANAGE_USERS = 'manage:users',
  MANAGE_API_KEYS = 'manage:api_keys',
  RULE_READ = 'read:rule',
  RULE_CREATE = 'create:rule',
  RULE_UPDATE = 'update:rule',
  RULE_DELETE = 'delete:rule',
}

/**
 * Role-permission mapping
 * Requirement 7.2: Support roles Admin, Editor, Viewer with different permission levels
 * Requirement 7.3: Admin role can perform any action
 * Requirement 7.4: Editor role can modify configurations
 * Requirement 7.5: Viewer role cannot modify configurations (403 Forbidden)
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  Admin: [
    Permission.READ_CONFIG,
    Permission.WRITE_CONFIG,
    Permission.DELETE_CONFIG,
    Permission.READ_AUDIT,
    Permission.MANAGE_USERS,
    Permission.MANAGE_API_KEYS,
    Permission.RULE_READ,
    Permission.RULE_CREATE,
    Permission.RULE_UPDATE,
    Permission.RULE_DELETE,
  ],
  Editor: [
    Permission.READ_CONFIG,
    Permission.WRITE_CONFIG,
    Permission.READ_AUDIT,
    Permission.RULE_READ,
    Permission.RULE_CREATE,
    Permission.RULE_UPDATE,
  ],
  Viewer: [
    Permission.READ_CONFIG,
    Permission.READ_AUDIT,
    Permission.RULE_READ,
  ],
};

/**
 * Check if a role has a specific permission
 * @param role User role (Admin, Editor, Viewer)
 * @param permission Permission to check
 * @returns true if role has permission, false otherwise
 */
export function hasPermission(role: string, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
