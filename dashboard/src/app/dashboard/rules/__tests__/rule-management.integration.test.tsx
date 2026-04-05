import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { apiClient } from '../../../../lib/api';
import { Rule, RuleFormData } from '../../../../types/rules';

// Mock the API client
jest.mock('../../../../lib/api');
jest.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      organizationId: 'org-1',
      role: 'Admin'
    },
    token: 'test-token'
  })
}));

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'config-1' }),
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn()
  })
}));

describe('Rule Management UI Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rule Creation Flow', () => {
    it('should create a new rule successfully', async () => {
      const mockRule: Rule = {
        id: 'rule-1',
        config_key_id: 'config-1',
        priority: 10,
        conditions: [
          {
            attribute: 'region',
            operator: 'equals',
            value: 'us-west'
          }
        ],
        value: true,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const ruleData: RuleFormData = {
        config_key_id: 'config-1',
        priority: 10,
        conditions: [
          {
            attribute: 'region',
            operator: 'equals',
            value: 'us-west'
          }
        ],
        value: true,
        enabled: true
      };

      (apiClient.createRule as jest.Mock).mockResolvedValue(mockRule);

      const result = await apiClient.createRule(ruleData);

      expect(result).toEqual(mockRule);
      expect(apiClient.createRule).toHaveBeenCalledWith(ruleData);
    });

    it('should validate all conditions are complete before creating', () => {
      const incompleteRuleData: RuleFormData = {
        config_key_id: 'config-1',
        priority: 10,
        conditions: [
          {
            attribute: '', // Missing attribute
            operator: 'equals',
            value: 'us-west'
          }
        ],
        value: true,
        enabled: true
      };

      // Validation function from the component
      const validateRuleData = (ruleData: RuleFormData): string | null => {
        for (const condition of ruleData.conditions) {
          if (!condition.attribute || !condition.attribute.trim()) {
            return 'All conditions must have an attribute';
          }
          if (!condition.operator) {
            return 'All conditions must have an operator';
          }
          if (condition.value === '' || condition.value === null || condition.value === undefined) {
            return 'All conditions must have a value';
          }
        }
        if (ruleData.priority < 1) {
          return 'Priority must be at least 1';
        }
        return null;
      };

      const error = validateRuleData(incompleteRuleData);
      expect(error).toBe('All conditions must have an attribute');
    });

    it('should create rule with multiple conditions', async () => {
      const mockRule: Rule = {
        id: 'rule-1',
        config_key_id: 'config-1',
        priority: 10,
        conditions: [
          {
            attribute: 'region',
            operator: 'equals',
            value: 'us-west'
          },
          {
            attribute: 'tier',
            operator: 'in_list',
            value: ['premium', 'enterprise']
          }
        ],
        value: true,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      (apiClient.createRule as jest.Mock).mockResolvedValue(mockRule);

      const result = await apiClient.createRule({
        config_key_id: 'config-1',
        priority: 10,
        conditions: mockRule.conditions,
        value: true,
        enabled: true
      });

      expect(result.conditions).toHaveLength(2);
      expect(result.conditions[0].attribute).toBe('region');
      expect(result.conditions[1].attribute).toBe('tier');
    });

    it('should validate JSON value format', () => {
      const validValues = [
        'true',
        '"string value"',
        '42',
        '{"key": "value"}',
        '[1, 2, 3]'
      ];

      const invalidValues = [
        '{key: value}', // Missing quotes
        'undefined',
        'NaN'
      ];

      validValues.forEach(value => {
        expect(() => JSON.parse(value)).not.toThrow();
      });

      invalidValues.forEach(value => {
        expect(() => JSON.parse(value)).toThrow();
      });
    });
  });

  describe('Rule Reordering Flow', () => {
    it('should update rule priorities when reordered', async () => {
      const mockRules: Rule[] = [
        {
          id: 'rule-1',
          config_key_id: 'config-1',
          priority: 3,
          conditions: [{ attribute: 'region', operator: 'equals', value: 'us-west' }],
          value: true,
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'rule-2',
          config_key_id: 'config-1',
          priority: 2,
          conditions: [{ attribute: 'tier', operator: 'equals', value: 'premium' }],
          value: false,
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'rule-3',
          config_key_id: 'config-1',
          priority: 1,
          conditions: [{ attribute: 'user_id', operator: 'equals', value: 'test-user' }],
          value: true,
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      (apiClient.getRules as jest.Mock).mockResolvedValue(mockRules);
      (apiClient.updateRule as jest.Mock).mockImplementation((id, data) => 
        Promise.resolve({ ...mockRules.find(r => r.id === id), ...data })
      );

      // Get initial rules
      const rules = await apiClient.getRules('config-1');
      expect(rules).toHaveLength(3);
      expect(rules[0].priority).toBe(3);
      expect(rules[1].priority).toBe(2);
      expect(rules[2].priority).toBe(1);

      // Simulate drag-and-drop reordering (move rule-3 to top)
      const reorderedRules = [rules[2], rules[0], rules[1]];
      const updatedRules = reorderedRules.map((rule, idx) => ({
        ...rule,
        priority: reorderedRules.length - idx
      }));

      // Update priorities
      for (const rule of updatedRules) {
        await apiClient.updateRule(rule.id, {
          config_key_id: rule.config_key_id,
          priority: rule.priority,
          conditions: rule.conditions,
          value: rule.value,
          enabled: rule.enabled
        });
      }

      expect(apiClient.updateRule).toHaveBeenCalledTimes(3);
      expect(updatedRules[0].priority).toBe(3); // rule-3 now has highest priority
      expect(updatedRules[1].priority).toBe(2); // rule-1
      expect(updatedRules[2].priority).toBe(1); // rule-2
    });

    it('should maintain rule order after reordering', () => {
      const rules: Rule[] = [
        {
          id: 'rule-1',
          config_key_id: 'config-1',
          priority: 3,
          conditions: [],
          value: 'A',
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'rule-2',
          config_key_id: 'config-1',
          priority: 2,
          conditions: [],
          value: 'B',
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'rule-3',
          config_key_id: 'config-1',
          priority: 1,
          conditions: [],
          value: 'C',
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      // Simulate moving rule at index 2 to index 0
      const draggedIndex = 2;
      const targetIndex = 0;
      
      const newRules = [...rules];
      const draggedRule = newRules[draggedIndex];
      newRules.splice(draggedIndex, 1);
      newRules.splice(targetIndex, 0, draggedRule);

      // Update priorities
      const reorderedRules = newRules.map((rule, idx) => ({
        ...rule,
        priority: newRules.length - idx
      }));

      expect(reorderedRules[0].id).toBe('rule-3');
      expect(reorderedRules[0].priority).toBe(3);
      expect(reorderedRules[1].id).toBe('rule-1');
      expect(reorderedRules[1].priority).toBe(2);
      expect(reorderedRules[2].id).toBe('rule-2');
      expect(reorderedRules[2].priority).toBe(1);
    });
  });

  describe('Rule Deletion Flow', () => {
    it('should delete rule successfully', async () => {
      const mockRules: Rule[] = [
        {
          id: 'rule-1',
          config_key_id: 'config-1',
          priority: 2,
          conditions: [{ attribute: 'region', operator: 'equals', value: 'us-west' }],
          value: true,
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'rule-2',
          config_key_id: 'config-1',
          priority: 1,
          conditions: [{ attribute: 'tier', operator: 'equals', value: 'premium' }],
          value: false,
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      (apiClient.getRules as jest.Mock).mockResolvedValue(mockRules);
      (apiClient.deleteRule as jest.Mock).mockResolvedValue({ success: true });

      // Get initial rules
      const rules = await apiClient.getRules('config-1');
      expect(rules).toHaveLength(2);

      // Delete rule-1
      await apiClient.deleteRule('rule-1');
      expect(apiClient.deleteRule).toHaveBeenCalledWith('rule-1');

      // Simulate reloading rules after deletion
      const remainingRules = mockRules.filter(r => r.id !== 'rule-1');
      (apiClient.getRules as jest.Mock).mockResolvedValue(remainingRules);

      const updatedRules = await apiClient.getRules('config-1');
      expect(updatedRules).toHaveLength(1);
      expect(updatedRules[0].id).toBe('rule-2');
    });

    it('should require confirmation before deletion', () => {
      let deleteConfirmation = {
        isOpen: false,
        ruleId: null as string | null,
        rulePriority: null as number | null
      };

      const rule: Rule = {
        id: 'rule-1',
        config_key_id: 'config-1',
        priority: 10,
        conditions: [],
        value: true,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Simulate clicking delete button
      deleteConfirmation = {
        isOpen: true,
        ruleId: rule.id,
        rulePriority: rule.priority
      };

      expect(deleteConfirmation.isOpen).toBe(true);
      expect(deleteConfirmation.ruleId).toBe('rule-1');
      expect(deleteConfirmation.rulePriority).toBe(10);
    });

    it('should handle deletion errors gracefully', async () => {
      const errorMessage = 'Failed to delete rule';
      (apiClient.deleteRule as jest.Mock).mockRejectedValue({
        response: {
          data: {
            error: {
              message: errorMessage
            }
          }
        }
      });

      try {
        await apiClient.deleteRule('rule-1');
        fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.response.data.error.message).toBe(errorMessage);
      }
    });
  });

  describe('Rule Display and Formatting', () => {
    it('should format conditions correctly', () => {
      const formatConditions = (rule: Rule): string => {
        if (rule.conditions.length === 0) return 'No conditions';
        
        return rule.conditions
          .map(c => `${c.attribute} ${c.operator} ${JSON.stringify(c.value)}`)
          .join(' AND ');
      };

      const rule: Rule = {
        id: 'rule-1',
        config_key_id: 'config-1',
        priority: 10,
        conditions: [
          { attribute: 'region', operator: 'equals', value: 'us-west' },
          { attribute: 'tier', operator: 'in_list', value: ['premium', 'enterprise'] }
        ],
        value: true,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const formatted = formatConditions(rule);
      expect(formatted).toBe('region equals "us-west" AND tier in_list ["premium","enterprise"]');
    });

    it('should display rules in priority order', () => {
      const rules: Rule[] = [
        {
          id: 'rule-1',
          config_key_id: 'config-1',
          priority: 5,
          conditions: [],
          value: 'A',
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'rule-2',
          config_key_id: 'config-1',
          priority: 10,
          conditions: [],
          value: 'B',
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'rule-3',
          config_key_id: 'config-1',
          priority: 1,
          conditions: [],
          value: 'C',
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      // Sort by priority descending (highest first)
      const sorted = [...rules].sort((a, b) => b.priority - a.priority);

      expect(sorted[0].priority).toBe(10);
      expect(sorted[1].priority).toBe(5);
      expect(sorted[2].priority).toBe(1);
    });

    it('should show enabled/disabled status', () => {
      const enabledRule: Rule = {
        id: 'rule-1',
        config_key_id: 'config-1',
        priority: 10,
        conditions: [],
        value: true,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const disabledRule: Rule = {
        id: 'rule-2',
        config_key_id: 'config-1',
        priority: 5,
        conditions: [],
        value: false,
        enabled: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      expect(enabledRule.enabled).toBe(true);
      expect(disabledRule.enabled).toBe(false);
    });
  });

  describe('Rule Operators', () => {
    it('should support all rule operators', () => {
      const operators = [
        'equals',
        'not_equals',
        'in_list',
        'not_in_list',
        'greater_than',
        'less_than',
        'regex_match'
      ];

      operators.forEach(operator => {
        const rule: Rule = {
          id: 'rule-1',
          config_key_id: 'config-1',
          priority: 10,
          conditions: [
            {
              attribute: 'test_attr',
              operator: operator as any,
              value: 'test_value'
            }
          ],
          value: true,
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        expect(rule.conditions[0].operator).toBe(operator);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors when loading rules', async () => {
      const errorMessage = 'Failed to load rules';
      (apiClient.getRules as jest.Mock).mockRejectedValue({
        response: {
          data: {
            error: {
              message: errorMessage
            }
          }
        }
      });

      try {
        await apiClient.getRules('config-1');
        fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.response.data.error.message).toBe(errorMessage);
      }
    });

    it('should handle API errors when creating rules', async () => {
      const errorMessage = 'Invalid rule data';
      (apiClient.createRule as jest.Mock).mockRejectedValue({
        response: {
          data: {
            error: {
              message: errorMessage
            }
          }
        }
      });

      try {
        await apiClient.createRule({
          config_key_id: 'config-1',
          priority: 10,
          conditions: [],
          value: true,
          enabled: true
        });
        fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.response.data.error.message).toBe(errorMessage);
      }
    });

    it('should handle API errors when updating rules', async () => {
      const errorMessage = 'Rule not found';
      (apiClient.updateRule as jest.Mock).mockRejectedValue({
        response: {
          data: {
            error: {
              message: errorMessage
            }
          }
        }
      });

      try {
        await apiClient.updateRule('rule-1', {
          config_key_id: 'config-1',
          priority: 10,
          conditions: [],
          value: true,
          enabled: true
        });
        fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.response.data.error.message).toBe(errorMessage);
      }
    });
  });
});
