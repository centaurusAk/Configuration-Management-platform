import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ConfigKey } from '../entities/config-key.entity';

@Injectable()
export class ConfigKeyRepository {
  constructor(
    @InjectRepository(ConfigKey)
    private readonly repository: Repository<ConfigKey>,
  ) {}

  async create(
    organizationId: string,
    projectId: string,
    environmentId: string,
    keyName: string,
    valueType: 'boolean' | 'string' | 'number' | 'json',
    currentValue: any,
    schema?: object,
  ): Promise<ConfigKey> {
    const configKey = this.repository.create({
      organization_id: organizationId,
      project_id: projectId,
      environment_id: environmentId,
      key_name: keyName,
      value_type: valueType,
      current_value: currentValue,
      schema,
    });
    return this.repository.save(configKey);
  }

  async findById(id: string, organizationId?: string): Promise<ConfigKey | null> {
    const where: any = { id, deleted_at: IsNull() };
    if (organizationId) {
      where.organization_id = organizationId;
    }
    return this.repository.findOne({ where });
  }

  async findByKey(
    organizationId: string,
    projectId: string,
    environmentId: string,
    keyName: string,
  ): Promise<ConfigKey | null> {
    return this.repository.findOne({
      where: {
        organization_id: organizationId,
        project_id: projectId,
        environment_id: environmentId,
        key_name: keyName,
        deleted_at: IsNull(),
      },
    });
  }

  async findByEnvironment(
    organizationId: string,
    projectId: string,
    environmentId: string,
  ): Promise<ConfigKey[]> {
    return this.repository.find({
      where: {
        organization_id: organizationId,
        project_id: projectId,
        environment_id: environmentId,
        deleted_at: IsNull(),
      },
    });
  }

  async findAll(organizationId?: string): Promise<ConfigKey[]> {
    const where: any = { deleted_at: IsNull() };
    if (organizationId) {
      where.organization_id = organizationId;
    }
    return this.repository.find({ where });
  }

  async update(
    id: string,
    updates: Partial<Pick<ConfigKey, 'current_value' | 'schema'>>,
  ): Promise<ConfigKey | null> {
    await this.repository.update(id, updates);
    return this.findById(id);
  }

  /**
   * Soft delete - sets deleted_at timestamp instead of removing record
   * Requirement 1.6: Prevent deletion of ConfigKeys that have historical versions
   */
  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  /**
   * Restore a soft-deleted config key
   */
  async restore(id: string): Promise<void> {
    await this.repository.restore(id);
  }

  /**
   * Find including soft-deleted records
   */
  async findByIdIncludingDeleted(id: string, organizationId?: string): Promise<ConfigKey | null> {
    const where: any = { id };
    if (organizationId) {
      where.organization_id = organizationId;
    }
    return this.repository.findOne({
      where,
      withDeleted: true,
    });
  }
}
