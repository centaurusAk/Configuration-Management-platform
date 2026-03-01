import { Permission, ROLE_PERMISSIONS, hasPermission } from './permissions';

describe('RBAC Permissions', () => {
  describe('Permission enum', () => {
    it('should define all required permissions', () => {
      expect(Permission.READ_CONFIG).toBe('read:config');
      expect(Permission.WRITE_CONFIG).toBe('write:config');
      expect(Permission.DELETE_CONFIG).toBe('delete:config');
      expect(Permission.READ_AUDIT).toBe('read:audit');
      expect(Permission.MANAGE_USERS).toBe('manage:users');
    });
  });

  describe('ROLE_PERMISSIONS mapping', () => {
    describe('Admin role', () => {
      it('should have all permissions (Requirement 7.3)', () => {
        const adminPermissions = ROLE_PERMISSIONS.Admin;
        
        expect(adminPermissions).toContain(Permission.READ_CONFIG);
        expect(adminPermissions).toContain(Permission.WRITE_CONFIG);
        expect(adminPermissions).toContain(Permission.DELETE_CONFIG);
        expect(adminPermissions).toContain(Permission.READ_AUDIT);
        expect(adminPermissions).toContain(Permission.MANAGE_USERS);
        expect(adminPermissions).toContain(Permission.RULE_READ);
        expect(adminPermissions).toContain(Permission.RULE_CREATE);
        expect(adminPermissions).toContain(Permission.RULE_UPDATE);
        expect(adminPermissions).toContain(Permission.RULE_DELETE);
        expect(adminPermissions.length).toBe(9);
      });
    });

    describe('Editor role', () => {
      it('should have read and write permissions but not delete or manage users (Requirement 7.4)', () => {
        const editorPermissions = ROLE_PERMISSIONS.Editor;
        
        expect(editorPermissions).toContain(Permission.READ_CONFIG);
        expect(editorPermissions).toContain(Permission.WRITE_CONFIG);
        expect(editorPermissions).toContain(Permission.READ_AUDIT);
        expect(editorPermissions).toContain(Permission.RULE_READ);
        expect(editorPermissions).toContain(Permission.RULE_CREATE);
        expect(editorPermissions).toContain(Permission.RULE_UPDATE);
        expect(editorPermissions).not.toContain(Permission.DELETE_CONFIG);
        expect(editorPermissions).not.toContain(Permission.MANAGE_USERS);
        expect(editorPermissions.length).toBe(6);
      });
    });

    describe('Viewer role', () => {
      it('should have only read permissions (Requirement 7.5)', () => {
        const viewerPermissions = ROLE_PERMISSIONS.Viewer;
        
        expect(viewerPermissions).toContain(Permission.READ_CONFIG);
        expect(viewerPermissions).toContain(Permission.READ_AUDIT);
        expect(viewerPermissions).toContain(Permission.RULE_READ);
        expect(viewerPermissions).not.toContain(Permission.WRITE_CONFIG);
        expect(viewerPermissions).not.toContain(Permission.DELETE_CONFIG);
        expect(viewerPermissions).not.toContain(Permission.MANAGE_USERS);
        expect(viewerPermissions.length).toBe(3);
      });
    });
  });

  describe('hasPermission function', () => {
    it('should return true when Admin has any permission (Requirement 7.3)', () => {
      expect(hasPermission('Admin', Permission.READ_CONFIG)).toBe(true);
      expect(hasPermission('Admin', Permission.WRITE_CONFIG)).toBe(true);
      expect(hasPermission('Admin', Permission.DELETE_CONFIG)).toBe(true);
      expect(hasPermission('Admin', Permission.READ_AUDIT)).toBe(true);
      expect(hasPermission('Admin', Permission.MANAGE_USERS)).toBe(true);
    });

    it('should return true when Editor has read/write permissions (Requirement 7.4)', () => {
      expect(hasPermission('Editor', Permission.READ_CONFIG)).toBe(true);
      expect(hasPermission('Editor', Permission.WRITE_CONFIG)).toBe(true);
      expect(hasPermission('Editor', Permission.READ_AUDIT)).toBe(true);
    });

    it('should return false when Editor lacks delete/manage permissions (Requirement 7.4)', () => {
      expect(hasPermission('Editor', Permission.DELETE_CONFIG)).toBe(false);
      expect(hasPermission('Editor', Permission.MANAGE_USERS)).toBe(false);
    });

    it('should return true when Viewer has read permissions (Requirement 7.5)', () => {
      expect(hasPermission('Viewer', Permission.READ_CONFIG)).toBe(true);
      expect(hasPermission('Viewer', Permission.READ_AUDIT)).toBe(true);
    });

    it('should return false when Viewer lacks write/delete/manage permissions (Requirement 7.5)', () => {
      expect(hasPermission('Viewer', Permission.WRITE_CONFIG)).toBe(false);
      expect(hasPermission('Viewer', Permission.DELETE_CONFIG)).toBe(false);
      expect(hasPermission('Viewer', Permission.MANAGE_USERS)).toBe(false);
    });

    it('should return false for unknown roles', () => {
      expect(hasPermission('UnknownRole', Permission.READ_CONFIG)).toBe(false);
      expect(hasPermission('UnknownRole', Permission.WRITE_CONFIG)).toBe(false);
    });

    it('should return false for undefined role', () => {
      expect(hasPermission(undefined as any, Permission.READ_CONFIG)).toBe(false);
    });
  });
});
