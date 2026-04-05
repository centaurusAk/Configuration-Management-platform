import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { Permission } from './permissions';
import { PERMISSIONS_KEY } from './require-permission.decorator';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  const createMockExecutionContext = (user: any, permissions: Permission[] | null): ExecutionContext => {
    const mockRequest = {
      user,
    };

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(permissions);

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  };

  describe('canActivate', () => {
    it('should allow access when no permissions are required', () => {
      const context = createMockExecutionContext({ role: 'Viewer' }, null);
      
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access when permissions array is empty', () => {
      const context = createMockExecutionContext({ role: 'Viewer' }, []);
      
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should throw ForbiddenException when user is not authenticated', () => {
      const context = createMockExecutionContext(null, [Permission.READ_CONFIG]);
      
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('User not authenticated');
    });

    describe('Admin role (Requirement 7.3)', () => {
      it('should allow Admin to access any endpoint', () => {
        const adminUser = { role: 'Admin', id: 'admin-1' };
        
        const readContext = createMockExecutionContext(adminUser, [Permission.READ_CONFIG]);
        expect(guard.canActivate(readContext)).toBe(true);
        
        const writeContext = createMockExecutionContext(adminUser, [Permission.WRITE_CONFIG]);
        expect(guard.canActivate(writeContext)).toBe(true);
        
        const deleteContext = createMockExecutionContext(adminUser, [Permission.DELETE_CONFIG]);
        expect(guard.canActivate(deleteContext)).toBe(true);
        
        const manageContext = createMockExecutionContext(adminUser, [Permission.MANAGE_USERS]);
        expect(guard.canActivate(manageContext)).toBe(true);
      });

      it('should allow Admin to access endpoints requiring multiple permissions', () => {
        const adminUser = { role: 'Admin', id: 'admin-1' };
        const context = createMockExecutionContext(adminUser, [
          Permission.WRITE_CONFIG,
          Permission.DELETE_CONFIG,
        ]);
        
        expect(guard.canActivate(context)).toBe(true);
      });
    });

    describe('Editor role (Requirement 7.4)', () => {
      it('should allow Editor to read configs', () => {
        const editorUser = { role: 'Editor', id: 'editor-1' };
        const context = createMockExecutionContext(editorUser, [Permission.READ_CONFIG]);
        
        expect(guard.canActivate(context)).toBe(true);
      });

      it('should allow Editor to write configs', () => {
        const editorUser = { role: 'Editor', id: 'editor-1' };
        const context = createMockExecutionContext(editorUser, [Permission.WRITE_CONFIG]);
        
        expect(guard.canActivate(context)).toBe(true);
      });

      it('should allow Editor to read audit logs', () => {
        const editorUser = { role: 'Editor', id: 'editor-1' };
        const context = createMockExecutionContext(editorUser, [Permission.READ_AUDIT]);
        
        expect(guard.canActivate(context)).toBe(true);
      });

      it('should reject Editor when trying to delete configs (Requirement 7.4)', () => {
        const editorUser = { role: 'Editor', id: 'editor-1' };
        const context = createMockExecutionContext(editorUser, [Permission.DELETE_CONFIG]);
        
        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
        expect(() => guard.canActivate(context)).toThrow(
          "User with role 'Editor' does not have required permissions"
        );
      });

      it('should reject Editor when trying to manage users', () => {
        const editorUser = { role: 'Editor', id: 'editor-1' };
        const context = createMockExecutionContext(editorUser, [Permission.MANAGE_USERS]);
        
        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      });
    });

    describe('Viewer role (Requirement 7.5)', () => {
      it('should allow Viewer to read configs', () => {
        const viewerUser = { role: 'Viewer', id: 'viewer-1' };
        const context = createMockExecutionContext(viewerUser, [Permission.READ_CONFIG]);
        
        expect(guard.canActivate(context)).toBe(true);
      });

      it('should allow Viewer to read audit logs', () => {
        const viewerUser = { role: 'Viewer', id: 'viewer-1' };
        const context = createMockExecutionContext(viewerUser, [Permission.READ_AUDIT]);
        
        expect(guard.canActivate(context)).toBe(true);
      });

      it('should reject Viewer when trying to write configs (Requirement 7.5)', () => {
        const viewerUser = { role: 'Viewer', id: 'viewer-1' };
        const context = createMockExecutionContext(viewerUser, [Permission.WRITE_CONFIG]);
        
        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
        expect(() => guard.canActivate(context)).toThrow(
          "User with role 'Viewer' does not have required permissions"
        );
      });

      it('should reject Viewer when trying to delete configs (Requirement 7.5)', () => {
        const viewerUser = { role: 'Viewer', id: 'viewer-1' };
        const context = createMockExecutionContext(viewerUser, [Permission.DELETE_CONFIG]);
        
        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      });

      it('should reject Viewer when trying to manage users', () => {
        const viewerUser = { role: 'Viewer', id: 'viewer-1' };
        const context = createMockExecutionContext(viewerUser, [Permission.MANAGE_USERS]);
        
        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      });
    });

    describe('Multiple permissions', () => {
      it('should allow access when user has all required permissions', () => {
        const adminUser = { role: 'Admin', id: 'admin-1' };
        const context = createMockExecutionContext(adminUser, [
          Permission.READ_CONFIG,
          Permission.WRITE_CONFIG,
        ]);
        
        expect(guard.canActivate(context)).toBe(true);
      });

      it('should reject access when user lacks any required permission', () => {
        const editorUser = { role: 'Editor', id: 'editor-1' };
        const context = createMockExecutionContext(editorUser, [
          Permission.WRITE_CONFIG,
          Permission.DELETE_CONFIG, // Editor doesn't have this
        ]);
        
        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      });
    });
  });
});
