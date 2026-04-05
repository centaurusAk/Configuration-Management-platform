import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './audit-log.service';
import { AuditLogRepository, AuditLogFilters } from '../repositories/audit-log.repository';
import { AuditLog } from '../entities/audit-log.entity';

/**
 * Unit Tests for Audit Log Filtering
 * 
 * Validates: Requirements 8.6
 * 
 * These tests verify that audit log queries support filtering by:
 * - Date range
 * - user_id
 * - action_type
 * - resource_type
 */
describe('Audit Log Filtering Unit Tests', () => {
  let auditLogService: AuditLogService;
  let mockRepository: any;

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      query: jest.fn(),
      findByResource: jest.fn(),
      findByUser: jest.fn(),
      findByOrganization: jest.fn(),
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
   * Test date range filtering
   * Requirement 8.6: Support filtering by date range
   */
  it('should filter audit logs by date range', async () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');
    
    const mockLogs: AuditLog[] = [
      {
        id: '1',
        timestamp: new Date('2024-01-15'),
        user_id: 'user-1',
        organization_id: 'org-1',
        action_type: 'CREATE',
        resource_type: 'CONFIG_KEY',
        resource_id: 'config-1',
        old_value: null,
        new_value: 'value1',
        metadata: null,
      } as any,
    ];

    mockRepository.query.mockResolvedValue(mockLogs);

    const filters: AuditLogFilters = {
      dateRange: { start: startDate, end: endDate },
    };

    const result = await auditLogService.query(filters);

    expect(mockRepository.query).toHaveBeenCalledWith(filters);
    expect(result).toEqual(mockLogs);
  });

  /**
   * Test user_id filtering
   * Requirement 8.6: Support filtering by user
   */
  it('should filter audit logs by user_id', async () => {
    const userId = 'user-123';
    
    const mockLogs: AuditLog[] = [
      {
        id: '1',
        timestamp: new Date(),
        user_id: userId,
        organization_id: 'org-1',
        action_type: 'UPDATE',
        resource_type: 'CONFIG_KEY',
        resource_id: 'config-1',
        old_value: 'old',
        new_value: 'new',
        metadata: null,
      } as any,
    ];

    mockRepository.query.mockResolvedValue(mockLogs);

    const filters: AuditLogFilters = {
      userId,
    };

    const result = await auditLogService.query(filters);

    expect(mockRepository.query).toHaveBeenCalledWith(filters);
    expect(result).toEqual(mockLogs);
    expect(result[0].user_id).toBe(userId);
  });

  /**
   * Test action_type filtering
   * Requirement 8.6: Support filtering by action type
   */
  it('should filter audit logs by action_type', async () => {
    const actionType = 'DELETE';
    
    const mockLogs: AuditLog[] = [
      {
        id: '1',
        timestamp: new Date(),
        user_id: 'user-1',
        organization_id: 'org-1',
        action_type: actionType,
        resource_type: 'CONFIG_KEY',
        resource_id: 'config-1',
        old_value: 'value',
        new_value: null,
        metadata: null,
      } as any,
    ];

    mockRepository.query.mockResolvedValue(mockLogs);

    const filters: AuditLogFilters = {
      actionType,
    };

    const result = await auditLogService.query(filters);

    expect(mockRepository.query).toHaveBeenCalledWith(filters);
    expect(result).toEqual(mockLogs);
    expect(result[0].action_type).toBe(actionType);
  });

  /**
   * Test resource_type filtering
   * Requirement 8.6: Support filtering by resource type
   */
  it('should filter audit logs by resource_type', async () => {
    const resourceType = 'RULE';
    
    const mockLogs: AuditLog[] = [
      {
        id: '1',
        timestamp: new Date(),
        user_id: 'user-1',
        organization_id: 'org-1',
        action_type: 'CREATE',
        resource_type: resourceType,
        resource_id: 'rule-1',
        old_value: null,
        new_value: { priority: 10 },
        metadata: null,
      } as any,
    ];

    mockRepository.query.mockResolvedValue(mockLogs);

    const filters: AuditLogFilters = {
      resourceType,
    };

    const result = await auditLogService.query(filters);

    expect(mockRepository.query).toHaveBeenCalledWith(filters);
    expect(result).toEqual(mockLogs);
    expect(result[0].resource_type).toBe(resourceType);
  });

  /**
   * Test combined filtering
   * Requirement 8.6: Support filtering with multiple criteria
   */
  it('should filter audit logs with multiple criteria', async () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');
    const userId = 'user-123';
    const actionType = 'UPDATE';
    const resourceType = 'CONFIG_KEY';
    
    const mockLogs: AuditLog[] = [
      {
        id: '1',
        timestamp: new Date('2024-01-15'),
        user_id: userId,
        organization_id: 'org-1',
        action_type: actionType,
        resource_type: resourceType,
        resource_id: 'config-1',
        old_value: 'old',
        new_value: 'new',
        metadata: null,
      } as any,
    ];

    mockRepository.query.mockResolvedValue(mockLogs);

    const filters: AuditLogFilters = {
      dateRange: { start: startDate, end: endDate },
      userId,
      actionType,
      resourceType,
    };

    const result = await auditLogService.query(filters);

    expect(mockRepository.query).toHaveBeenCalledWith(filters);
    expect(result).toEqual(mockLogs);
    expect(result[0].user_id).toBe(userId);
    expect(result[0].action_type).toBe(actionType);
    expect(result[0].resource_type).toBe(resourceType);
  });

  /**
   * Test limit parameter
   * Requirement 8.6: Support limiting query results
   */
  it('should respect limit parameter in query', async () => {
    const mockLogs: AuditLog[] = [
      {
        id: '1',
        timestamp: new Date(),
        user_id: 'user-1',
        organization_id: 'org-1',
        action_type: 'CREATE',
        resource_type: 'CONFIG_KEY',
        resource_id: 'config-1',
        old_value: null,
        new_value: 'value',
        metadata: null,
      } as any,
    ];

    mockRepository.query.mockResolvedValue(mockLogs);

    const filters: AuditLogFilters = {
      limit: 50,
    };

    await auditLogService.query(filters);

    expect(mockRepository.query).toHaveBeenCalledWith(filters);
  });

  /**
   * Test getByResource method
   * Requirement 8.6: Support querying by specific resource
   */
  it('should get audit logs for a specific resource', async () => {
    const resourceType = 'CONFIG_KEY';
    const resourceId = 'config-123';
    
    const mockLogs: AuditLog[] = [
      {
        id: '1',
        timestamp: new Date(),
        user_id: 'user-1',
        organization_id: 'org-1',
        action_type: 'CREATE',
        resource_type: resourceType,
        resource_id: resourceId,
        old_value: null,
        new_value: 'value',
        metadata: null,
      } as any,
      {
        id: '2',
        timestamp: new Date(),
        user_id: 'user-2',
        organization_id: 'org-1',
        action_type: 'UPDATE',
        resource_type: resourceType,
        resource_id: resourceId,
        old_value: 'value',
        new_value: 'new-value',
        metadata: null,
      } as any,
    ];

    mockRepository.findByResource.mockResolvedValue(mockLogs);

    const result = await auditLogService.getByResource(resourceType, resourceId);

    expect(mockRepository.findByResource).toHaveBeenCalledWith(resourceType, resourceId);
    expect(result).toEqual(mockLogs);
    expect(result.length).toBe(2);
    expect(result.every(log => log.resource_id === resourceId)).toBe(true);
  });

  /**
   * Test getByUser method
   * Requirement 8.6: Support querying by user
   */
  it('should get audit logs for a specific user', async () => {
    const userId = 'user-123';
    const limit = 100;
    
    const mockLogs: AuditLog[] = [
      {
        id: '1',
        timestamp: new Date(),
        user_id: userId,
        organization_id: 'org-1',
        action_type: 'CREATE',
        resource_type: 'CONFIG_KEY',
        resource_id: 'config-1',
        old_value: null,
        new_value: 'value',
        metadata: null,
      } as any,
    ];

    mockRepository.findByUser.mockResolvedValue(mockLogs);

    const result = await auditLogService.getByUser(userId, limit);

    expect(mockRepository.findByUser).toHaveBeenCalledWith(userId, limit);
    expect(result).toEqual(mockLogs);
    expect(result[0].user_id).toBe(userId);
  });

  /**
   * Test getByOrganization method
   * Requirement 8.6: Support querying by organization
   */
  it('should get audit logs for a specific organization', async () => {
    const organizationId = 'org-123';
    const limit = 100;
    
    const mockLogs: AuditLog[] = [
      {
        id: '1',
        timestamp: new Date(),
        user_id: 'user-1',
        organization_id: organizationId,
        action_type: 'CREATE',
        resource_type: 'CONFIG_KEY',
        resource_id: 'config-1',
        old_value: null,
        new_value: 'value',
        metadata: null,
      } as any,
    ];

    mockRepository.findByOrganization.mockResolvedValue(mockLogs);

    const result = await auditLogService.getByOrganization(organizationId, limit);

    expect(mockRepository.findByOrganization).toHaveBeenCalledWith(organizationId, limit);
    expect(result).toEqual(mockLogs);
    expect(result[0].organization_id).toBe(organizationId);
  });

  /**
   * Test empty results
   * Requirement 8.6: Handle queries with no matching results
   */
  it('should return empty array when no logs match filters', async () => {
    mockRepository.query.mockResolvedValue([]);

    const filters: AuditLogFilters = {
      userId: 'non-existent-user',
    };

    const result = await auditLogService.query(filters);

    expect(result).toEqual([]);
    expect(result.length).toBe(0);
  });
});
