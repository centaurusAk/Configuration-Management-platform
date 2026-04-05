import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as fc from 'fast-check';
import { PermissionsGuard } from './permissions.guard';
import { Permission, ROLE_PERMISSIONS } from './permissions';
import { PERMISSIONS_KEY } from './require-permission.decorator';

/**
 * Property-Based Tests for RBAC Permissions
 * 
 * **Validates: Requirements 7.2, 7.3, 7.4, 7.5**
 * 
 * Property 28: RBAC permissions are enforced
 * For any user with role R and any operation requiring permission P,
 * the operation should succeed if and only if role R has permission P
 * in the RBAC permission matrix.
 */
describe('Property Test: RBAC Permissions Enforcement', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  /**
   * Helper to create a mock ExecutionContext
   */
  const createMockExecutionContext = (
    user: any,
    requiredPermissions: Permission[] | null,
  ): ExecutionContext => {
    const mockRequest = { user };

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredPermissions);

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  };

  /**
   * Arbitrary generator for valid roles
   */
  const roleArbitrary = fc.constantFrom('Admin', 'Editor', 'Viewer');

  /**
   * Arbitrary generator for permissions
   */
  const permissionArbitrary = fc.constantFrom(
    Permission.READ_CONFIG,
    Permission.WRITE_CONFIG,
    Permission.DELETE_CONFIG,
    Permission.READ_AUDIT,
    Permission.MANAGE_USERS,
    Permission.RULE_READ,
    Permission.RULE_CREATE,
    Permission.RULE_UPDATE,
    Permission.RULE_DELETE,
  );

  /**
   * Property 28: RBAC permissions are enforced
   * 
   * For ANY role R and ANY permission P, the guard should allow access
   * if and only if role R has permission P in the ROLE_PERMISSIONS matrix.
   */
  it('should enforce RBAC permissions for any role and permission combination', () => {
    fc.assert(
      fc.property(
        roleArbitrary,
        fc.array(permissionArbitrary, { minLength: 1, maxLength: 5 }),
        fc.uuid(), // user ID
        (role: string, requiredPermissions: Permission[], userId: string) => {
          // Arrange: Create user with the generated role
          const user = { role, id: userId };
          const context = createMockExecutionContext(user, requiredPermissions);

          // Determine expected outcome based on ROLE_PERMISSIONS matrix
          const userPermissions = ROLE_PERMISSIONS[role] || [];
          const hasAllPermissions = requiredPermissions.every((perm) =>
            userPermissions.includes(perm),
          );

          // Act & Assert
          if (hasAllPermissions) {
            // User has all required permissions - should succeed
            expect(guard.canActivate(context)).toBe(true);
          } else {
            // User lacks at least one permission - should throw ForbiddenException
            expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
            expect(() => guard.canActivate(context)).toThrow(
              `User with role '${role}' does not have required permissions`,
            );
          }
        },
      ),
      {
        numRuns: 200, // Run 200 random test cases
        verbose: true,
      },
    );
  });

  /**
   * Property 28.1: Admin role has all permissions
   * 
   * For ANY permission P, an Admin user should always have access.
   * This validates Requirement 7.3: Admin role can perform any action.
   */
  it('should allow Admin role to access any endpoint requiring any permission', () => {
    fc.assert(
      fc.property(
        fc.array(permissionArbitrary, { minLength: 1, maxLength: 5 }),
        fc.uuid(),
        (requiredPermissions: Permission[], userId: string) => {
          // Arrange: Create Admin user
          const adminUser = { role: 'Admin', id: userId };
          const context = createMockExecutionContext(adminUser, requiredPermissions);

          // Act & Assert: Admin should always have access
          expect(guard.canActivate(context)).toBe(true);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 28.2: Editor role permissions are enforced
   * 
   * For ANY permission P, an Editor user should have access if and only if
   * P is in [READ_CONFIG, WRITE_CONFIG, READ_AUDIT].
   * This validates Requirement 7.4: Editor role can modify configurations.
   */
  it('should enforce Editor role permissions correctly', () => {
    fc.assert(
      fc.property(
        permissionArbitrary,
        fc.uuid(),
        (permission: Permission, userId: string) => {
          // Arrange: Create Editor user
          const editorUser = { role: 'Editor', id: userId };
          const context = createMockExecutionContext(editorUser, [permission]);

          // Determine if Editor has this permission
          const editorPermissions = ROLE_PERMISSIONS['Editor'];
          const hasPermission = editorPermissions.includes(permission);

          // Act & Assert
          if (hasPermission) {
            expect(guard.canActivate(context)).toBe(true);
          } else {
            expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
            expect(() => guard.canActivate(context)).toThrow(
              "User with role 'Editor' does not have required permissions",
            );
          }
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 28.3: Viewer role cannot modify configurations
   * 
   * For ANY write permission (WRITE_CONFIG, DELETE_CONFIG, MANAGE_USERS),
   * a Viewer user should be rejected with 403 Forbidden.
   * This validates Requirement 7.5: Viewer role cannot modify configurations.
   */
  it('should reject Viewer role for any write operation', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          Permission.WRITE_CONFIG,
          Permission.DELETE_CONFIG,
          Permission.MANAGE_USERS,
        ),
        fc.uuid(),
        (writePermission: Permission, userId: string) => {
          // Arrange: Create Viewer user
          const viewerUser = { role: 'Viewer', id: userId };
          const context = createMockExecutionContext(viewerUser, [writePermission]);

          // Act & Assert: Viewer should be rejected for write operations
          expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
          expect(() => guard.canActivate(context)).toThrow(
            "User with role 'Viewer' does not have required permissions",
          );
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 28.4: Viewer role can read
   * 
   * For ANY read permission (READ_CONFIG, READ_AUDIT),
   * a Viewer user should have access.
   */
  it('should allow Viewer role to access read-only endpoints', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(Permission.READ_CONFIG, Permission.READ_AUDIT),
        fc.uuid(),
        (readPermission: Permission, userId: string) => {
          // Arrange: Create Viewer user
          const viewerUser = { role: 'Viewer', id: userId };
          const context = createMockExecutionContext(viewerUser, [readPermission]);

          // Act & Assert: Viewer should have access to read operations
          expect(guard.canActivate(context)).toBe(true);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 28.5: Multiple permissions require ALL to be present
   * 
   * For ANY role R and ANY set of permissions [P1, P2, ..., Pn],
   * access should be granted if and only if role R has ALL permissions
   * in the set (AND logic).
   */
  it('should require ALL permissions when multiple are specified', () => {
    fc.assert(
      fc.property(
        roleArbitrary,
        fc.array(permissionArbitrary, { minLength: 2, maxLength: 5 }),
        fc.uuid(),
        (role: string, requiredPermissions: Permission[], userId: string) => {
          // Arrange: Create user with the generated role
          const user = { role, id: userId };
          const context = createMockExecutionContext(user, requiredPermissions);

          // Determine if user has ALL required permissions
          const userPermissions = ROLE_PERMISSIONS[role] || [];
          const hasAllPermissions = requiredPermissions.every((perm) =>
            userPermissions.includes(perm),
          );

          // Act & Assert
          if (hasAllPermissions) {
            expect(guard.canActivate(context)).toBe(true);
          } else {
            expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
          }
        },
      ),
      {
        numRuns: 200,
        verbose: true,
      },
    );
  });

  /**
   * Property 28.6: No permissions required allows all authenticated users
   * 
   * For ANY role R, when no permissions are required (null or empty array),
   * access should be granted.
   */
  it('should allow any authenticated user when no permissions are required', () => {
    fc.assert(
      fc.property(
        roleArbitrary,
        fc.uuid(),
        fc.constantFrom(null, []),
        (role: string, userId: string, requiredPermissions: Permission[] | null) => {
          // Arrange: Create user with any role
          const user = { role, id: userId };
          const context = createMockExecutionContext(user, requiredPermissions);

          // Act & Assert: Should allow access
          expect(guard.canActivate(context)).toBe(true);
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 28.7: Unauthenticated users are always rejected
   * 
   * For ANY permission P, when user is null or undefined,
   * access should be rejected with ForbiddenException.
   */
  it('should reject unauthenticated users for any permission', () => {
    fc.assert(
      fc.property(
        fc.array(permissionArbitrary, { minLength: 1, maxLength: 5 }),
        (requiredPermissions: Permission[]) => {
          // Arrange: Create context with no user
          const context = createMockExecutionContext(null, requiredPermissions);

          // Act & Assert: Should throw ForbiddenException
          expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
          expect(() => guard.canActivate(context)).toThrow('User not authenticated');
        },
      ),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });

  /**
   * Property 28.8: Permission matrix consistency
   * 
   * Verify that the ROLE_PERMISSIONS matrix is consistent with requirements:
   * - Admin has all 9 permissions
   * - Editor has exactly 6 permissions (READ_CONFIG, WRITE_CONFIG, READ_AUDIT, RULE_READ, RULE_CREATE, RULE_UPDATE)
   * - Viewer has exactly 3 permissions (READ_CONFIG, READ_AUDIT, RULE_READ)
   */
  it('should have consistent permission matrix matching requirements', () => {
    // Requirement 7.3: Admin has all permissions
    expect(ROLE_PERMISSIONS['Admin']).toHaveLength(9);
    expect(ROLE_PERMISSIONS['Admin']).toContain(Permission.READ_CONFIG);
    expect(ROLE_PERMISSIONS['Admin']).toContain(Permission.WRITE_CONFIG);
    expect(ROLE_PERMISSIONS['Admin']).toContain(Permission.DELETE_CONFIG);
    expect(ROLE_PERMISSIONS['Admin']).toContain(Permission.READ_AUDIT);
    expect(ROLE_PERMISSIONS['Admin']).toContain(Permission.MANAGE_USERS);
    expect(ROLE_PERMISSIONS['Admin']).toContain(Permission.RULE_READ);
    expect(ROLE_PERMISSIONS['Admin']).toContain(Permission.RULE_CREATE);
    expect(ROLE_PERMISSIONS['Admin']).toContain(Permission.RULE_UPDATE);
    expect(ROLE_PERMISSIONS['Admin']).toContain(Permission.RULE_DELETE);

    // Requirement 7.4: Editor can modify configurations
    expect(ROLE_PERMISSIONS['Editor']).toHaveLength(6);
    expect(ROLE_PERMISSIONS['Editor']).toContain(Permission.READ_CONFIG);
    expect(ROLE_PERMISSIONS['Editor']).toContain(Permission.WRITE_CONFIG);
    expect(ROLE_PERMISSIONS['Editor']).toContain(Permission.READ_AUDIT);
    expect(ROLE_PERMISSIONS['Editor']).toContain(Permission.RULE_READ);
    expect(ROLE_PERMISSIONS['Editor']).toContain(Permission.RULE_CREATE);
    expect(ROLE_PERMISSIONS['Editor']).toContain(Permission.RULE_UPDATE);
    expect(ROLE_PERMISSIONS['Editor']).not.toContain(Permission.DELETE_CONFIG);
    expect(ROLE_PERMISSIONS['Editor']).not.toContain(Permission.MANAGE_USERS);

    // Requirement 7.5: Viewer cannot modify configurations
    expect(ROLE_PERMISSIONS['Viewer']).toHaveLength(3);
    expect(ROLE_PERMISSIONS['Viewer']).toContain(Permission.READ_CONFIG);
    expect(ROLE_PERMISSIONS['Viewer']).toContain(Permission.READ_AUDIT);
    expect(ROLE_PERMISSIONS['Viewer']).toContain(Permission.RULE_READ);
    expect(ROLE_PERMISSIONS['Viewer']).not.toContain(Permission.WRITE_CONFIG);
    expect(ROLE_PERMISSIONS['Viewer']).not.toContain(Permission.DELETE_CONFIG);
    expect(ROLE_PERMISSIONS['Viewer']).not.toContain(Permission.MANAGE_USERS);
  });

  /**
   * Property 28.9: Role hierarchy is enforced
   * 
   * For ANY permission P:
   * - If Viewer has P, then Editor must have P
   * - If Editor has P, then Admin must have P
   * 
   * This ensures a proper permission hierarchy.
   */
  it('should enforce role hierarchy (Viewer ⊆ Editor ⊆ Admin)', () => {
    fc.assert(
      fc.property(permissionArbitrary, (permission: Permission) => {
        const viewerHas = ROLE_PERMISSIONS['Viewer'].includes(permission);
        const editorHas = ROLE_PERMISSIONS['Editor'].includes(permission);
        const adminHas = ROLE_PERMISSIONS['Admin'].includes(permission);

        // If Viewer has permission, Editor must have it
        if (viewerHas) {
          expect(editorHas).toBe(true);
        }

        // If Editor has permission, Admin must have it
        if (editorHas) {
          expect(adminHas).toBe(true);
        }

        // Admin always has all permissions
        expect(adminHas).toBe(true);
      }),
      {
        numRuns: 100,
        verbose: true,
      },
    );
  });
});
