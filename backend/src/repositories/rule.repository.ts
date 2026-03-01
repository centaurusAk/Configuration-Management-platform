import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rule } from '../entities/rule.entity';
import { Condition } from '../types/models';

@Injectable()
export class RuleRepository {
  constructor(
    @InjectRepository(Rule)
    private readonly repository: Repository<Rule>,
  ) {}

  async create(
    configKeyId: string,
    priority: number,
    conditions: Condition[],
    value: any,
    enabled: boolean = true,
  ): Promise<Rule> {
    const rule = this.repository.create({
      config_key_id: configKeyId,
      priority,
      conditions,
      value,
      enabled,
    });
    return this.repository.save(rule);
  }

  async findById(id: string, organizationId?: string): Promise<Rule | null> {
    if (!organizationId) {
      return this.repository.findOne({ where: { id } });
    }
    
    // Join with config_keys to filter by organization
    return this.repository
      .createQueryBuilder('rule')
      .innerJoin('config_keys', 'config', 'config.id = rule.config_key_id')
      .where('rule.id = :id', { id })
      .andWhere('config.organization_id = :organizationId', { organizationId })
      .getOne();
  }

  /**
   * Get all rules for a config key ordered by priority (highest first)
   * Requirement 4.2: Rules evaluated in priority order
   */
  async findByConfigKey(configKeyId: string, organizationId?: string): Promise<Rule[]> {
    if (!organizationId) {
      return this.repository.find({
        where: { config_key_id: configKeyId },
        order: { priority: 'DESC' },
      });
    }
    
    // Join with config_keys to filter by organization
    return this.repository
      .createQueryBuilder('rule')
      .innerJoin('config_keys', 'config', 'config.id = rule.config_key_id')
      .where('rule.config_key_id = :configKeyId', { configKeyId })
      .andWhere('config.organization_id = :organizationId', { organizationId })
      .orderBy('rule.priority', 'DESC')
      .getMany();
  }

  /**
   * Get only enabled rules for a config key ordered by priority
   * Used for rule evaluation
   */
  async findEnabledByConfigKey(configKeyId: string, organizationId?: string): Promise<Rule[]> {
    if (!organizationId) {
      return this.repository.find({
        where: { config_key_id: configKeyId, enabled: true },
        order: { priority: 'DESC' },
      });
    }
    
    // Join with config_keys to filter by organization
    return this.repository
      .createQueryBuilder('rule')
      .innerJoin('config_keys', 'config', 'config.id = rule.config_key_id')
      .where('rule.config_key_id = :configKeyId', { configKeyId })
      .andWhere('rule.enabled = :enabled', { enabled: true })
      .andWhere('config.organization_id = :organizationId', { organizationId })
      .orderBy('rule.priority', 'DESC')
      .getMany();
  }

  async findAll(organizationId?: string): Promise<Rule[]> {
    if (!organizationId) {
      return this.repository.find();
    }
    
    // Join with config_keys to filter by organization
    return this.repository
      .createQueryBuilder('rule')
      .innerJoin('config_keys', 'config', 'config.id = rule.config_key_id')
      .where('config.organization_id = :organizationId', { organizationId })
      .getMany();
  }

  async update(
    id: string,
    updates: Partial<Pick<Rule, 'priority' | 'conditions' | 'value' | 'enabled'>>,
  ): Promise<Rule | null> {
    await this.repository.update(id, updates);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  /**
   * Update priorities for multiple rules (used for reordering)
   */
  async updatePriorities(updates: Array<{ id: string; priority: number }>): Promise<void> {
    await this.repository.manager.transaction(async (manager) => {
      for (const update of updates) {
        await manager.update(Rule, update.id, { priority: update.priority });
      }
    });
  }
}
