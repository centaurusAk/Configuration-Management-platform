import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigVersion } from '../entities/config-version.entity';

/**
 * Repository for ConfigVersion entity
 * Requirement 2.5: Append-only pattern - only INSERT operations allowed
 * UPDATE and DELETE operations are prevented at the database level via triggers
 */
@Injectable()
export class ConfigVersionRepository {
  constructor(
    @InjectRepository(ConfigVersion)
    private readonly repository: Repository<ConfigVersion>,
  ) {}

  /**
   * Create a new config version
   * This is the ONLY write operation allowed for config versions
   */
  async create(
    configKeyId: string,
    value: any,
    createdBy: string,
  ): Promise<ConfigVersion> {
    const version = this.repository.create({
      config_key_id: configKeyId,
      value,
      created_by: createdBy,
    });
    return this.repository.save(version);
  }

  /**
   * Find a specific version by ID
   */
  async findById(id: string, organizationId?: string): Promise<ConfigVersion | null> {
    if (!organizationId) {
      return this.repository.findOne({ where: { id } });
    }
    
    // Join with config_keys to filter by organization
    return this.repository
      .createQueryBuilder('version')
      .innerJoin('config_keys', 'config', 'config.id = version.config_key_id')
      .where('version.id = :id', { id })
      .andWhere('config.organization_id = :organizationId', { organizationId })
      .getOne();
  }

  /**
   * Get all versions for a config key in reverse chronological order
   * Requirement 2.2: Return versions in reverse chronological order
   */
  async findByConfigKey(configKeyId: string, organizationId?: string): Promise<ConfigVersion[]> {
    if (!organizationId) {
      return this.repository.find({
        where: { config_key_id: configKeyId },
        order: { created_at: 'DESC' },
      });
    }
    
    // Join with config_keys to filter by organization
    return this.repository
      .createQueryBuilder('version')
      .innerJoin('config_keys', 'config', 'config.id = version.config_key_id')
      .where('version.config_key_id = :configKeyId', { configKeyId })
      .andWhere('config.organization_id = :organizationId', { organizationId })
      .orderBy('version.created_at', 'DESC')
      .getMany();
  }

  /**
   * Get the latest version for a config key
   * Requirement 1.5: Return most recent version
   */
  async findLatestByConfigKey(
    configKeyId: string,
    organizationId?: string,
  ): Promise<ConfigVersion | null> {
    if (!organizationId) {
      return this.repository.findOne({
        where: { config_key_id: configKeyId },
        order: { created_at: 'DESC' },
      });
    }
    
    // Join with config_keys to filter by organization
    return this.repository
      .createQueryBuilder('version')
      .innerJoin('config_keys', 'config', 'config.id = version.config_key_id')
      .where('version.config_key_id = :configKeyId', { configKeyId })
      .andWhere('config.organization_id = :organizationId', { organizationId })
      .orderBy('version.created_at', 'DESC')
      .limit(1)
      .getOne();
  }

  /**
   * Count versions for a config key
   */
  async countByConfigKey(configKeyId: string, organizationId?: string): Promise<number> {
    if (!organizationId) {
      return this.repository.count({
        where: { config_key_id: configKeyId },
      });
    }
    
    // Join with config_keys to filter by organization
    return this.repository
      .createQueryBuilder('version')
      .innerJoin('config_keys', 'config', 'config.id = version.config_key_id')
      .where('version.config_key_id = :configKeyId', { configKeyId })
      .andWhere('config.organization_id = :organizationId', { organizationId })
      .getCount();
  }

  /**
   * NOTE: Update and delete methods are intentionally NOT implemented
   * to enforce append-only pattern. Any attempts to update or delete
   * will be blocked by database triggers.
   */
}
