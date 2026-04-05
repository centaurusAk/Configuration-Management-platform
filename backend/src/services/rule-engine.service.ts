import { Injectable, Inject } from '@nestjs/common';
import { RuleRepository } from '../repositories/rule.repository';
import { ConfigKeyRepository } from '../repositories/config-key.repository';
import { Context } from '../types/models';
import { evaluateConditions } from './rule-engine.utils';
import { isUserInRollout } from './rollout.utils';
import { CacheService, buildCacheKey } from './cache.service';
import { AuditLogService } from './audit-log.service';

/**
 * RuleEngine service for evaluating context-aware rules
 * 
 * Requirements: 4.2, 4.3, 4.4, 6.1, 6.3
 * 
 * The RuleEngine evaluates rules in priority order (highest first) and returns
 * the value from the first matching rule. If no rules match, it returns the
 * default value from the config key.
 * 
 * Caching: Checks cache before evaluating rules, populates cache on misses
 */
@Injectable()
export class RuleEngineService {
  constructor(
    private readonly ruleRepository: RuleRepository,
    private readonly configKeyRepository: ConfigKeyRepository,
    @Inject('CacheService') private readonly cacheService: CacheService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Evaluate rules for a config key and return the appropriate value
   * 
   * Algorithm:
   * 1. Check cache first (Requirement 6.1)
   * 2. If cache miss, fetch all enabled rules for the config key, ordered by priority DESC
   * 3. Evaluate each rule in priority order
   * 4. For percentage rollout rules, first check other conditions, then use isUserInRollout
   * 5. For regular rules, evaluate conditions
   * 6. Return the value from the first matching rule
   * 7. If no rules match, return the default value from the config key
   * 8. Cache the result with 60s TTL (Requirement 6.3)
   * 
   * Requirements: 3.1, 3.2, 3.3, 4.2, 4.3, 4.4, 6.1, 6.3
   * 
   * @param configKeyId - The ID of the config key
   * @param context - The context to evaluate rules against
   * @returns The evaluated configuration value
   * @throws Error if config key not found
   */
  async evaluate(configKeyId: string, context: Context): Promise<any> {
    // Get config key for metadata needed for cache key
    const configKey = await this.configKeyRepository.findById(configKeyId);
    
    if (!configKey) {
      throw new Error(`Config key not found: ${configKeyId}`);
    }

    // Build cache key (Requirement 6.6)
    const cacheKey = buildCacheKey(
      configKey.organization_id,
      configKey.project_id,
      configKey.environment_id,
      configKey.key_name,
      context,
    );

    // Check cache first (Requirement 6.1)
    // Requirement 9.1: Continue when Redis unavailable
    let cached: any = null;
    try {
      cached = await this.cacheService.get(cacheKey);
      if (cached !== null) {
        return cached;
      }
    } catch (error) {
      // Redis unavailable, continue to database query
      // This is expected behavior for graceful degradation
    }

    // Cache miss - evaluate rules
    // Fetch all enabled rules ordered by priority (highest first)
    // Requirement 4.2: Rules evaluated in priority order
    const rules = await this.ruleRepository.findEnabledByConfigKey(configKeyId);

    let result: any;

    // Evaluate each rule in priority order
    for (const rule of rules) {
      if (!rule.enabled) {
        continue;
      }

      // Check if this is a percentage rollout rule
      // Percentage rollout rules have a special condition with attribute '_percentage_rollout'
      const percentageCondition = rule.conditions.find(
        c => c.attribute === '_percentage_rollout'
      );

      if (percentageCondition) {
        // This is a percentage rollout rule
        // First, evaluate all other conditions (non-percentage conditions)
        const otherConditions = rule.conditions.filter(
          c => c.attribute !== '_percentage_rollout'
        );

        // If there are other conditions, they must all match first
        if (otherConditions.length > 0 && !evaluateConditions(otherConditions, context)) {
          // Other conditions didn't match, skip this rule
          continue;
        }

        // Other conditions matched (or there were none), now check percentage rollout
        // Requirements 3.1, 3.2, 3.3: Use deterministic hashing for percentage rollout
        
        if (!context.user_id) {
          // No user_id in context, skip this rule (Requirement 3.3)
          continue;
        }

        const percentage = Number(percentageCondition.value);
        
        // Use the config key name for the rollout hash
        if (isUserInRollout(context.user_id, configKey.key_name, percentage)) {
          // User is in the rollout percentage
          result = rule.value;
          break;
        }
        // User is not in rollout, continue to next rule
        continue;
      }

      // Regular rule - evaluate conditions
      // Requirement 4.3: Return value from first matching rule
      if (evaluateConditions(rule.conditions, context)) {
        result = rule.value;
        break;
      }
    }

    // If no rule matched, use default value
    // Requirement 4.4: Return default value when no rules match
    if (result === undefined) {
      result = configKey.current_value;
    }

    // Cache the result with 60s TTL (Requirement 6.3)
    // Requirement 9.1: Best effort caching, don't fail if Redis unavailable
    try {
      await this.cacheService.set(cacheKey, result, 60);
    } catch (error) {
      // Redis unavailable, continue without caching
      // This is expected behavior for graceful degradation
    }

    return result;
  }

  /**
   * Create a new rule
   * Requirement 6.5: Invalidate cache on rule changes
   * Requirement 8.2: Audit rule changes
   */
  async createRule(
    configKeyId: string,
    priority: number,
    conditions: any[],
    value: any,
    createdBy: string,
    enabled: boolean = true,
  ): Promise<any> {
    // Get config key for organization_id
    const configKey = await this.configKeyRepository.findById(configKeyId);
    if (!configKey) {
      throw new Error(`Config key not found: ${configKeyId}`);
    }

    const rule = await this.ruleRepository.create(
      configKeyId,
      priority,
      conditions,
      value,
      enabled,
    );

    // Audit log the rule creation (Requirement 8.2)
    await this.auditLogService.log(
      createdBy,
      configKey.organization_id,
      'CREATE',
      'RULE',
      rule.id,
      null,
      {
        priority,
        conditions,
        value,
        enabled,
      },
      {
        config_key_id: configKeyId,
        config_key_name: configKey.key_name,
      },
    );

    // Invalidate cache for this config (Requirement 6.5)
    await this.invalidateCacheForConfigKey(configKeyId);

    return rule;
  }

  /**
   * Update an existing rule
   * Requirement 6.5: Invalidate cache on rule changes
   * Requirement 8.2: Audit rule changes
   */
  async updateRule(
    ruleId: string,
    updates: Partial<{ priority: number; conditions: any[]; value: any; enabled: boolean }>,
    updatedBy: string,
  ): Promise<any> {
    const rule = await this.ruleRepository.findById(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    // Get config key for organization_id
    const configKey = await this.configKeyRepository.findById(rule.config_key_id);
    if (!configKey) {
      throw new Error(`Config key not found: ${rule.config_key_id}`);
    }

    // Store old values for audit log
    const oldValue = {
      priority: rule.priority,
      conditions: rule.conditions,
      value: rule.value,
      enabled: rule.enabled,
    };

    const updatedRule = await this.ruleRepository.update(ruleId, updates);

    if (!updatedRule) {
      throw new Error(`Failed to update rule: ${ruleId}`);
    }

    // Audit log the rule update (Requirement 8.2)
    await this.auditLogService.log(
      updatedBy,
      configKey.organization_id,
      'UPDATE',
      'RULE',
      ruleId,
      oldValue,
      {
        priority: updatedRule.priority,
        conditions: updatedRule.conditions,
        value: updatedRule.value,
        enabled: updatedRule.enabled,
      },
      {
        config_key_id: rule.config_key_id,
        config_key_name: configKey.key_name,
      },
    );

    // Invalidate cache for this config (Requirement 6.5)
    await this.invalidateCacheForConfigKey(rule.config_key_id);

    return updatedRule;
  }

  /**
   * Delete a rule
   * Requirement 6.5: Invalidate cache on rule changes
   * Requirement 8.2: Audit rule changes
   */
  async deleteRule(ruleId: string, deletedBy: string): Promise<void> {
    const rule = await this.ruleRepository.findById(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    // Get config key for organization_id
    const configKey = await this.configKeyRepository.findById(rule.config_key_id);
    if (!configKey) {
      throw new Error(`Config key not found: ${rule.config_key_id}`);
    }

    // Store old values for audit log
    const oldValue = {
      priority: rule.priority,
      conditions: rule.conditions,
      value: rule.value,
      enabled: rule.enabled,
    };

    await this.ruleRepository.delete(ruleId);

    // Audit log the rule deletion (Requirement 8.2)
    await this.auditLogService.log(
      deletedBy,
      configKey.organization_id,
      'DELETE',
      'RULE',
      ruleId,
      oldValue,
      null,
      {
        config_key_id: rule.config_key_id,
        config_key_name: configKey.key_name,
      },
    );

    // Invalidate cache for this config (Requirement 6.5)
    await this.invalidateCacheForConfigKey(rule.config_key_id);
  }

  /**
   * Invalidate all cache entries for a config key
   * Requirement 6.5: Invalidate cache on rule changes
   * 
   * This is called when rules are created, updated, or deleted to ensure
   * that cached config values are refreshed with the new rule logic.
   */
  private async invalidateCacheForConfigKey(configKeyId: string): Promise<void> {
    const configKey = await this.configKeyRepository.findById(configKeyId);
    
    if (!configKey) {
      return;
    }

    // Invalidate all context-specific config values for this key
    // Requirement 9.1: Best effort cache invalidation, don't fail if Redis unavailable
    try {
      await this.cacheService.invalidateConfig(
        configKey.organization_id,
        configKey.project_id,
        configKey.environment_id,
        configKey.key_name,
      );
    } catch (error) {
      // Redis unavailable, continue without cache invalidation
      // This is expected behavior for graceful degradation
    }
  }

    /**
     * Evaluate rules with detailed trace information for testing
     *
     * Returns the evaluated value along with information about which rule matched
     * and the evaluation status of all rules.
     *
     * Requirements: 20.2, 20.3, 20.4, 20.5
     *
     * @param configKeyId - The ID of the config key
     * @param context - The context to evaluate rules against
     * @returns Evaluation result with trace information
     */
    async evaluateWithTrace(configKeyId: string, context: Context): Promise<{
      value: any;
      matched_rule: any | null;
      default_value: any;
      evaluation_trace: Array<{
        rule_id: string;
        priority: number;
        matched: boolean;
        reason?: string;
      }>;
    }> {
      // Get config key
      const configKey = await this.configKeyRepository.findById(configKeyId);

      if (!configKey) {
        throw new Error(`Config key not found: ${configKeyId}`);
      }

      // Fetch all enabled rules ordered by priority
      const rules = await this.ruleRepository.findEnabledByConfigKey(configKeyId);

      const evaluationTrace: Array<{
        rule_id: string;
        priority: number;
        matched: boolean;
        reason?: string;
      }> = [];

      let matchedRule: any | null = null;
      let resultValue: any = undefined;

      // Evaluate each rule in priority order
      for (const rule of rules) {
        if (!rule.enabled) {
          evaluationTrace.push({
            rule_id: rule.id,
            priority: rule.priority,
            matched: false,
            reason: 'Rule is disabled',
          });
          continue;
        }

        // Check if this is a percentage rollout rule
        const percentageCondition = rule.conditions.find(
          c => c.attribute === '_percentage_rollout'
        );

        if (percentageCondition) {
          // Evaluate other conditions first
          const otherConditions = rule.conditions.filter(
            c => c.attribute !== '_percentage_rollout'
          );

          if (otherConditions.length > 0 && !evaluateConditions(otherConditions, context)) {
            evaluationTrace.push({
              rule_id: rule.id,
              priority: rule.priority,
              matched: false,
              reason: 'Non-percentage conditions did not match',
            });
            continue;
          }

          // Check percentage rollout
          if (!context.user_id) {
            evaluationTrace.push({
              rule_id: rule.id,
              priority: rule.priority,
              matched: false,
              reason: 'No user_id in context for percentage rollout',
            });
            continue;
          }

          const percentage = Number(percentageCondition.value);

          if (isUserInRollout(context.user_id, configKey.key_name, percentage)) {
            evaluationTrace.push({
              rule_id: rule.id,
              priority: rule.priority,
              matched: true,
            });
            matchedRule = rule;
            resultValue = rule.value;
            break;
          } else {
            evaluationTrace.push({
              rule_id: rule.id,
              priority: rule.priority,
              matched: false,
              reason: `User not in ${percentage}% rollout`,
            });
          }
          continue;
        }

        // Regular rule - evaluate conditions
        if (evaluateConditions(rule.conditions, context)) {
          evaluationTrace.push({
            rule_id: rule.id,
            priority: rule.priority,
            matched: true,
          });
          matchedRule = rule;
          resultValue = rule.value;
          break;
        } else {
          evaluationTrace.push({
            rule_id: rule.id,
            priority: rule.priority,
            matched: false,
            reason: 'Conditions did not match',
          });
        }
      }

      // If no rule matched, use default value
      if (resultValue === undefined) {
        resultValue = configKey.current_value;
      }

      return {
        value: resultValue,
        matched_rule: matchedRule,
        default_value: configKey.current_value,
        evaluation_trace: evaluationTrace,
      };
    }
}
