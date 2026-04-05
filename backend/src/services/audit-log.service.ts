import { Injectable } from '@nestjs/common';
import { AuditLogRepository, AuditLogFilters } from '../repositories/audit-log.repository';
import { AuditLog } from '../entities/audit-log.entity';

/**
 * Service for managing audit logs
 * Implements append-only audit logging with filtering support
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.6
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  /**
   * Log an audit event (append-only write)
   * Requirement 8.4: Record all required fields
   * 
   * @param userId - ID of the user performing the action
   * @param organizationId - ID of the organization
   * @param actionType - Type of action (CREATE, UPDATE, DELETE, ROLLBACK)
   * @param resourceType - Type of resource being modified
   * @param resourceId - ID of the resource
   * @param oldValue - Previous value (optional, for UPDATE/DELETE/ROLLBACK)
   * @param newValue - New value (optional, for CREATE/UPDATE/ROLLBACK)
   * @param metadata - Additional metadata (optional)
   * @returns The created audit log entry
   */
  async log(
    userId: string,
    organizationId: string,
    actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'ROLLBACK',
    resourceType: 'CONFIG_KEY' | 'CONFIG_VERSION' | 'RULE' | 'API_KEY' | 'USER',
    resourceId: string,
    oldValue?: any,
    newValue?: any,
    metadata?: Record<string, any>,
  ): Promise<AuditLog> {
    return this.auditLogRepository.create(
      userId,
      organizationId,
      actionType,
      resourceType,
      resourceId,
      oldValue,
      newValue,
      metadata,
    );
  }

  /**
   * Query audit logs with filtering support
   * Requirement 8.6: Support filtering by date range, user, action type, and resource
   * 
   * @param filters - Filtering criteria
   * @returns Array of audit log entries matching the filters
   */
  async query(filters: AuditLogFilters): Promise<AuditLog[]> {
    return this.auditLogRepository.query(filters);
  }

  /**
   * Get audit logs for a specific resource
   * 
   * @param resourceType - Type of resource
   * @param resourceId - ID of the resource
   * @returns Array of audit log entries for the resource
   */
  async getByResource(
    resourceType: 'CONFIG_KEY' | 'CONFIG_VERSION' | 'RULE' | 'API_KEY' | 'USER',
    resourceId: string,
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.findByResource(resourceType, resourceId);
  }

  /**
   * Get audit logs for a specific user
   * 
   * @param userId - ID of the user
   * @param limit - Maximum number of entries to return (default: 100)
   * @returns Array of audit log entries for the user
   */
  async getByUser(userId: string, limit?: number): Promise<AuditLog[]> {
    return this.auditLogRepository.findByUser(userId, limit);
  }

  /**
   * Get audit logs for an organization
   * 
   * @param organizationId - ID of the organization
   * @param limit - Maximum number of entries to return (default: 100)
   * @returns Array of audit log entries for the organization
   */
  async getByOrganization(organizationId: string, limit?: number): Promise<AuditLog[]> {
    return this.auditLogRepository.findByOrganization(organizationId, limit);
  }
}
