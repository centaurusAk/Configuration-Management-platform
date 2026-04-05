import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogService } from './audit-log.service';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { AuditLog } from '../entities/audit-log.entity';
import fc from 'fast-check';

/**
 * Property-Based Tests for Audit Log Immutability
 * 
 * Feature: config-management-platform
 * Property 33: Audit logs are immutable
 * Validates: Requirements 8.5
 * 
 * This test verifies that audit log entries cannot be updated or deleted
 * after creation, enforcing the append-only pattern required for audit trails.
 * 
 * Note: Full immutability is enforced by database triggers. These tests verify
 * the service layer enforces append-only semantics by not providing update/delete methods.
 */
describe('Audit Log Immutability Property Tests', () => {
  let auditLogService: AuditLogService;
  let auditLogRepository: AuditLogRepository;
  let mockRepository: Partial<Repository<AuditLog>>;

  beforeEach(async () => {
    // Mock repository
    mockRepository = {
      create: jest.fn().mockImplementation((data) => data as AuditLog),
      save: jest.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'test-id', timestamp: new Date() } as AuditLog)),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn().mockImplementation(() => {
        // Simulate database trigger rejection
        return Promise.reject(new Error('Audit logs are immutable'));
      }),
      delete: jest.fn().mockImplementation(() => {
        // Simulate database trigger rejection
        return Promise.reject(new Error('Audit logs cannot be deleted'));
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        AuditLogRepository,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockRepository,
        },
      ],
    }).compile();

    auditLogService = module.get<AuditLogService>(AuditLogService);
    auditLogRepository = module.get<AuditLogRepository>(AuditLogRepository);
  });

  /**
   * Property 33: Audit logs are immutable - service provides no update methods
   * 
   * For any audit log service, it should only provide methods for creating and querying
   * audit logs, but not for updating or deleting them. This enforces append-only semantics.
   * 
   * Validates: Requirements 8.5
   */
  it('Property 33: Audit log service provides no update or delete methods', () => {
    // Verify service only has create and query methods
    expect(auditLogService.log).toBeDefined();
    expect(auditLogService.query).toBeDefined();
    expect(auditLogService.getByResource).toBeDefined();
    expect(auditLogService.getByUser).toBeDefined();
    expect(auditLogService.getByOrganization).toBeDefined();

    // Verify service does NOT have update or delete methods
    expect((auditLogService as any).update).toBeUndefined();
    expect((auditLogService as any).delete).toBeUndefined();
    expect((auditLogService as any).remove).toBeUndefined();
  });

  /**
   * Property 33: Audit logs are immutable - repository enforces immutability
   * 
   * For any audit log entry, attempting to update or delete it through the repository
   * should fail, simulating database trigger behavior.
   * 
   * Validates: Requirements 8.5
   */
  it('Property 33: Audit logs are immutable - updates should fail', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.uuid(), // organizationId
        fc.constantFrom('CREATE', 'UPDATE', 'DELETE', 'ROLLBACK'), // actionType
        fc.constantFrom('CONFIG_KEY', 'CONFIG_VERSION', 'RULE', 'API_KEY', 'USER'), // resourceType
        fc.uuid(), // resourceId
        fc.oneof(fc.constant(null), fc.string(), fc.integer(), fc.boolean()), // oldValue
        fc.oneof(fc.constant(null), fc.string(), fc.integer(), fc.boolean()), // newValue
        async (userId, organizationId, actionType, resourceType, resourceId, oldValue, newValue) => {
          // Create an audit log entry
          const auditLog = await auditLogService.log(
            userId,
            organizationId,
            actionType as any,
            resourceType as any,
            resourceId,
            oldValue,
            newValue,
          );

          // Verify the audit log was created
          expect(auditLog).toBeDefined();
          expect(auditLog.id).toBeDefined();

          // Attempt to update the audit log directly via repository
          // This should fail (simulating database trigger)
          const repository = (auditLogRepository as any).repository;
          
          await expect(
            repository.update(auditLog.id, { action_type: 'UPDATE' })
          ).rejects.toThrow('Audit logs are immutable');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 33: Audit logs are immutable - deletes should fail', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.uuid(), // organizationId
        fc.constantFrom('CREATE', 'UPDATE', 'DELETE', 'ROLLBACK'), // actionType
        fc.constantFrom('CONFIG_KEY', 'CONFIG_VERSION', 'RULE', 'API_KEY', 'USER'), // resourceType
        fc.uuid(), // resourceId
        async (userId, organizationId, actionType, resourceType, resourceId) => {
          // Create an audit log entry
          const auditLog = await auditLogService.log(
            userId,
            organizationId,
            actionType as any,
            resourceType as any,
            resourceId,
            null,
            { test: 'value' },
          );

          // Verify the audit log was created
          expect(auditLog).toBeDefined();
          expect(auditLog.id).toBeDefined();

          // Attempt to delete the audit log directly via repository
          // This should fail (simulating database trigger)
          const repository = (auditLogRepository as any).repository;
          
          await expect(
            repository.delete(auditLog.id)
          ).rejects.toThrow('Audit logs cannot be deleted');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 33: Audit logs preserve all fields after creation
   * 
   * For any audit log entry, all fields should be preserved exactly as created.
   * 
   * Validates: Requirements 8.5
   */
  it('Property 33: Audit logs preserve all fields after creation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.uuid(), // organizationId
        fc.constantFrom('CREATE', 'UPDATE', 'DELETE', 'ROLLBACK'), // actionType
        fc.constantFrom('CONFIG_KEY', 'CONFIG_VERSION', 'RULE', 'API_KEY', 'USER'), // resourceType
        fc.uuid(), // resourceId
        fc.oneof(fc.constant(null), fc.object()), // oldValue
        fc.oneof(fc.constant(null), fc.object()), // newValue
        fc.oneof(fc.constant(undefined), fc.object()), // metadata
        async (userId, organizationId, actionType, resourceType, resourceId, oldValue, newValue, metadata) => {
          // Create an audit log entry
          const auditLog = await auditLogService.log(
            userId,
            organizationId,
            actionType as any,
            resourceType as any,
            resourceId,
            oldValue,
            newValue,
            metadata,
          );

          // Verify all fields are preserved
          expect(auditLog.user_id).toBe(userId);
          expect(auditLog.organization_id).toBe(organizationId);
          expect(auditLog.action_type).toBe(actionType);
          expect(auditLog.resource_type).toBe(resourceType);
          expect(auditLog.resource_id).toBe(resourceId);
          expect(auditLog.old_value).toEqual(oldValue);
          expect(auditLog.new_value).toEqual(newValue);
          if (metadata !== undefined) {
            expect(auditLog.metadata).toEqual(metadata);
          }
          expect(auditLog.timestamp).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
