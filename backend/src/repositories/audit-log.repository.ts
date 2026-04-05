import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

export interface AuditLogFilters {
  dateRange?: { start: Date; end: Date };
  userId?: string;
  actionType?: 'CREATE' | 'UPDATE' | 'DELETE' | 'ROLLBACK';
  resourceType?: 'CONFIG_KEY' | 'CONFIG_VERSION' | 'RULE' | 'API_KEY' | 'USER';
  resourceId?: string;
  organizationId?: string;
  limit?: number;
}

/**
 * Repository for AuditLog entity
 * Requirement 8.5: Append-only pattern - only INSERT operations allowed
 * UPDATE and DELETE operations are prevented at the database level via triggers
 */
@Injectable()
export class AuditLogRepository {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repository: Repository<AuditLog>,
  ) {}

  /**
   * Create a new audit log entry
   * This is the ONLY write operation allowed for audit logs
   * Requirement 8.4: Record all required fields
   */
  async create(
    userId: string,
    organizationId: string,
    actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'ROLLBACK',
    resourceType: 'CONFIG_KEY' | 'CONFIG_VERSION' | 'RULE' | 'API_KEY' | 'USER',
    resourceId: string,
    oldValue?: any,
    newValue?: any,
    metadata?: Record<string, any>,
  ): Promise<AuditLog> {
    const auditLog = this.repository.create({
      user_id: userId,
      organization_id: organizationId,
      action_type: actionType,
      resource_type: resourceType,
      resource_id: resourceId,
      old_value: oldValue,
      new_value: newValue,
      metadata,
    });
    return this.repository.save(auditLog);
  }

  /**
   * Find audit log by ID
   */
  async findById(id: string): Promise<AuditLog | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * Query audit logs with filtering support
   * Requirement 8.6: Support filtering by date range, user, action type, and resource
   */
  async query(filters: AuditLogFilters): Promise<AuditLog[]> {
    const where: FindOptionsWhere<AuditLog> = {};

    if (filters.userId) {
      where.user_id = filters.userId;
    }

    if (filters.actionType) {
      where.action_type = filters.actionType;
    }

    if (filters.resourceType) {
      where.resource_type = filters.resourceType;
    }

    if (filters.resourceId) {
      where.resource_id = filters.resourceId;
    }

    if (filters.organizationId) {
      where.organization_id = filters.organizationId;
    }

    if (filters.dateRange) {
      where.timestamp = Between(filters.dateRange.start, filters.dateRange.end);
    }

    return this.repository.find({
      where,
      order: { timestamp: 'DESC' },
      take: filters.limit ?? 100,
    });
  }

  /**
   * Get audit logs for a specific resource
   */
  async findByResource(
    resourceType: 'CONFIG_KEY' | 'CONFIG_VERSION' | 'RULE' | 'API_KEY' | 'USER',
    resourceId: string,
  ): Promise<AuditLog[]> {
    return this.repository.find({
      where: { resource_type: resourceType, resource_id: resourceId },
      order: { timestamp: 'DESC' },
    });
  }

  /**
   * Get audit logs for a specific user
   */
  async findByUser(userId: string, limit: number = 100): Promise<AuditLog[]> {
    return this.repository.find({
      where: { user_id: userId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get audit logs for an organization
   */
  async findByOrganization(
    organizationId: string,
    limit: number = 100,
  ): Promise<AuditLog[]> {
    return this.repository.find({
      where: { organization_id: organizationId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * NOTE: Update and delete methods are intentionally NOT implemented
   * to enforce append-only pattern. Any attempts to update or delete
   * will be blocked by database triggers.
   */
}
