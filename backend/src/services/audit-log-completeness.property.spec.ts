import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './audit-log.service';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { AuditLog } from '../entities/audit-log.entity';
import fc from 'fast-check';

/**
 * Property-Based Tests for Audit Log Completeness
 * 
 * Feature: config-management-platform
 * Property 30: Config changes are audited
 * Property 31: Rule changes are audited
 * Validates: Requirements 8.1, 8.2
 * 
 * These tests verify that the audit log service correctly records all required fields
 * for configuration and rule changes.
 */
describe('Audit Log Completeness Property Tests', () => {
  let auditLogService: AuditLogService;
  let mockRepository: any;
  let capturedLogs: any[];

  beforeEach(async () => {
    capturedLogs = [];

    // Mock repository that captures all log calls
    mockRepository = {
      create: jest.fn().mockImplementation((userId, orgId, actionType, resourceType, resourceId, oldValue, newValue, metadata) => {
        const log = {
          id: `audit-${capturedLogs.length}`,
          user_id: userId,
          organization_id: orgId,
          action_type: actionType,
          resource_type: resourceType,
          resource_id: resourceId,
          old_value: oldValue,
          new_value: newValue,
          metadata,
          timestamp: new Date(),
        };
        capturedLogs.push(log);
        return Promise.resolve(log as AuditLog);
      }),
      query: jest.fn(),
      findByResource: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: AuditLogRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    auditLogService = module.get<AuditLogService>(AuditLogService);
  });

  /**
   * Property 30: Config changes are audited
   * 
   * For any config change, an audit log entry should be created with all required fields:
   * - user_id
   * - organization_id
   * - action_type (CREATE, UPDATE, DELETE, ROLLBACK)
   * - resource_type (CONFIG_KEY)
   * - resource_id
   * - old_value and new_value reflecting the change
   * 
   * Validates: Requirements 8.1
   */
  it('Property 30: Config CREATE is audited with all required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.uuid(), // organizationId
        fc.uuid(), // resourceId
        fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.object()), // newValue
        async (userId, organizationId, resourceId, newValue) => {
          capturedLogs = [];

          await auditLogService.log(
            userId,
            organizationId,
            'CREATE',
            'CONFIG_KEY',
            resourceId,
            null,
            newValue,
          );

          expect(capturedLogs.length).toBe(1);
          const log = capturedLogs[0];
          
          expect(log.user_id).toBe(userId);
          expect(log.organization_id).toBe(organizationId);
          expect(log.action_type).toBe('CREATE');
          expect(log.resource_type).toBe('CONFIG_KEY');
          expect(log.resource_id).toBe(resourceId);
          expect(log.old_value).toBeNull();
          expect(log.new_value).toEqual(newValue);
          expect(log.timestamp).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 30: Config UPDATE is audited with old and new values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.uuid(), // organizationId
        fc.uuid(), // resourceId
        fc.oneof(fc.string(), fc.integer(), fc.boolean()), // oldValue
        fc.oneof(fc.string(), fc.integer(), fc.boolean()), // newValue
        async (userId, organizationId, resourceId, oldValue, newValue) => {
          capturedLogs = [];

          await auditLogService.log(
            userId,
            organizationId,
            'UPDATE',
            'CONFIG_KEY',
            resourceId,
            oldValue,
            newValue,
          );

          expect(capturedLogs.length).toBe(1);
          const log = capturedLogs[0];
          
          expect(log.action_type).toBe('UPDATE');
          expect(log.old_value).toEqual(oldValue);
          expect(log.new_value).toEqual(newValue);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 30: Config DELETE is audited with old value', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.uuid(), // organizationId
        fc.uuid(), // resourceId
        fc.oneof(fc.string(), fc.integer(), fc.boolean()), // oldValue
        async (userId, organizationId, resourceId, oldValue) => {
          capturedLogs = [];

          await auditLogService.log(
            userId,
            organizationId,
            'DELETE',
            'CONFIG_KEY',
            resourceId,
            oldValue,
            null,
          );

          expect(capturedLogs.length).toBe(1);
          const log = capturedLogs[0];
          
          expect(log.action_type).toBe('DELETE');
          expect(log.old_value).toEqual(oldValue);
          expect(log.new_value).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 30: Config ROLLBACK is audited with metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.uuid(), // organizationId
        fc.uuid(), // resourceId
        fc.uuid(), // sourceVersionId
        fc.oneof(fc.string(), fc.integer(), fc.boolean()), // oldValue
        fc.oneof(fc.string(), fc.integer(), fc.boolean()), // newValue
        async (userId, organizationId, resourceId, sourceVersionId, oldValue, newValue) => {
          capturedLogs = [];

          await auditLogService.log(
            userId,
            organizationId,
            'ROLLBACK',
            'CONFIG_KEY',
            resourceId,
            oldValue,
            newValue,
            { source_version_id: sourceVersionId },
          );

          expect(capturedLogs.length).toBe(1);
          const log = capturedLogs[0];
          
          expect(log.action_type).toBe('ROLLBACK');
          expect(log.old_value).toEqual(oldValue);
          expect(log.new_value).toEqual(newValue);
          expect(log.metadata).toBeDefined();
          expect(log.metadata.source_version_id).toBe(sourceVersionId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 31: Rule changes are audited
   * 
   * For any rule change, an audit log entry should be created with all required fields:
   * - user_id
   * - organization_id
   * - action_type (CREATE, UPDATE, DELETE)
   * - resource_type (RULE)
   * - resource_id
   * - old_value and new_value reflecting the change
   * 
   * Validates: Requirements 8.2
   */
  it('Property 31: Rule CREATE is audited with all required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.uuid(), // organizationId
        fc.uuid(), // resourceId
        fc.integer({ min: 1, max: 100 }), // priority
        fc.array(fc.object()), // conditions
        fc.string(), // value
        async (userId, organizationId, resourceId, priority, conditions, value) => {
          capturedLogs = [];

          await auditLogService.log(
            userId,
            organizationId,
            'CREATE',
            'RULE',
            resourceId,
            null,
            { priority, conditions, value, enabled: true },
          );

          expect(capturedLogs.length).toBe(1);
          const log = capturedLogs[0];
          
          expect(log.user_id).toBe(userId);
          expect(log.organization_id).toBe(organizationId);
          expect(log.action_type).toBe('CREATE');
          expect(log.resource_type).toBe('RULE');
          expect(log.resource_id).toBe(resourceId);
          expect(log.old_value).toBeNull();
          expect(log.new_value).toBeDefined();
          expect(log.new_value.priority).toBe(priority);
          expect(log.new_value.value).toBe(value);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 31: Rule UPDATE is audited with old and new values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.uuid(), // organizationId
        fc.uuid(), // resourceId
        fc.integer({ min: 1, max: 100 }), // oldPriority
        fc.integer({ min: 1, max: 100 }), // newPriority
        fc.string(), // oldValue
        fc.string(), // newValue
        async (userId, organizationId, resourceId, oldPriority, newPriority, oldValue, newValue) => {
          capturedLogs = [];

          await auditLogService.log(
            userId,
            organizationId,
            'UPDATE',
            'RULE',
            resourceId,
            { priority: oldPriority, value: oldValue },
            { priority: newPriority, value: newValue },
          );

          expect(capturedLogs.length).toBe(1);
          const log = capturedLogs[0];
          
          expect(log.action_type).toBe('UPDATE');
          expect(log.old_value.priority).toBe(oldPriority);
          expect(log.new_value.priority).toBe(newPriority);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 31: Rule DELETE is audited with old value', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.uuid(), // organizationId
        fc.uuid(), // resourceId
        fc.integer({ min: 1, max: 100 }), // priority
        fc.string(), // value
        async (userId, organizationId, resourceId, priority, value) => {
          capturedLogs = [];

          await auditLogService.log(
            userId,
            organizationId,
            'DELETE',
            'RULE',
            resourceId,
            { priority, value, enabled: true },
            null,
          );

          expect(capturedLogs.length).toBe(1);
          const log = capturedLogs[0];
          
          expect(log.action_type).toBe('DELETE');
          expect(log.old_value).toBeDefined();
          expect(log.old_value.priority).toBe(priority);
          expect(log.new_value).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
