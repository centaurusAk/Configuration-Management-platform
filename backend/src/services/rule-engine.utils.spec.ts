import { evaluateConditions } from './rule-engine.utils';
import { Condition, Context } from '../types/models';

/**
 * Unit Tests for Rule Engine Utilities
 * 
 * **Validates: Requirements 4.5, 4.6, 4.7**
 * 
 * These tests focus on specific scenarios and edge cases for:
 * - Individual operator behavior
 * - Context attribute validation
 * - Edge cases and error handling
 * 
 * Complements the property-based tests with concrete examples.
 */
describe('Rule Engine Utils - Unit Tests', () => {
  describe('equals operator', () => {
    it('should match when values are equal', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'equals', value: 'us-east-1' },
      ];
      const context: Context = { region: 'us-east-1' };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should not match when values are different', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'equals', value: 'us-east-1' },
      ];
      const context: Context = { region: 'us-west-2' };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should handle string equality', () => {
      const conditions: Condition[] = [
        { attribute: 'tier', operator: 'equals', value: 'premium' },
      ];
      const context: Context = { tier: 'premium' };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should handle number equality', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.count', operator: 'equals', value: 42 },
      ];
      const context: Context = { custom_attributes: { count: 42 } };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should handle boolean equality', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.enabled', operator: 'equals', value: true },
      ];
      const context: Context = { custom_attributes: { enabled: true } };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should not match when attribute is missing', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'equals', value: 'us-east-1' },
      ];
      const context: Context = {};

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should handle case-sensitive string comparison', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'equals', value: 'US-EAST-1' },
      ];
      const context: Context = { region: 'us-east-1' };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });
  });

  describe('not_equals operator', () => {
    it('should match when values are different', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'not_equals', value: 'us-east-1' },
      ];
      const context: Context = { region: 'us-west-2' };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should not match when values are equal', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'not_equals', value: 'us-east-1' },
      ];
      const context: Context = { region: 'us-east-1' };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should match when attribute is missing (undefined !== value)', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'not_equals', value: 'us-east-1' },
      ];
      const context: Context = {};

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should handle different types', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.count', operator: 'not_equals', value: 42 },
      ];
      const context: Context = { custom_attributes: { count: '42' } };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });
  });

  describe('in_list operator', () => {
    it('should match when value is in the list', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'in_list', value: ['us-east-1', 'us-west-2', 'eu-west-1'] },
      ];
      const context: Context = { region: 'us-west-2' };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should not match when value is not in the list', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'in_list', value: ['us-east-1', 'us-west-2'] },
      ];
      const context: Context = { region: 'eu-west-1' };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should handle single-item list', () => {
      const conditions: Condition[] = [
        { attribute: 'tier', operator: 'in_list', value: ['premium'] },
      ];
      const context: Context = { tier: 'premium' };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should handle empty list (never matches)', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'in_list', value: [] },
      ];
      const context: Context = { region: 'us-east-1' };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should not match when attribute is missing', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'in_list', value: ['us-east-1'] },
      ];
      const context: Context = {};

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should handle list with different types', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.value', operator: 'in_list', value: [1, 2, 3, 'four'] },
      ];
      const context: Context = { custom_attributes: { value: 'four' } };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should return false when condition value is not an array', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'in_list', value: 'not-an-array' as any },
      ];
      const context: Context = { region: 'us-east-1' };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });
  });

  describe('not_in_list operator', () => {
    it('should match when value is not in the list', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'not_in_list', value: ['us-east-1', 'us-west-2'] },
      ];
      const context: Context = { region: 'eu-west-1' };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should not match when value is in the list', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'not_in_list', value: ['us-east-1', 'us-west-2', 'eu-west-1'] },
      ];
      const context: Context = { region: 'us-west-2' };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should match when attribute is missing (undefined not in list)', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'not_in_list', value: ['us-east-1'] },
      ];
      const context: Context = {};

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should match with empty list (everything is not in empty list)', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'not_in_list', value: [] },
      ];
      const context: Context = { region: 'us-east-1' };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should return false when condition value is not an array', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'not_in_list', value: 'not-an-array' as any },
      ];
      const context: Context = { region: 'us-east-1' };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });
  });

  describe('greater_than operator', () => {
    it('should match when value is greater', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.score', operator: 'greater_than', value: 50 },
      ];
      const context: Context = { custom_attributes: { score: 75 } };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should not match when value is equal', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.score', operator: 'greater_than', value: 50 },
      ];
      const context: Context = { custom_attributes: { score: 50 } };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should not match when value is less', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.score', operator: 'greater_than', value: 50 },
      ];
      const context: Context = { custom_attributes: { score: 25 } };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should handle negative numbers', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.temperature', operator: 'greater_than', value: -10 },
      ];
      const context: Context = { custom_attributes: { temperature: -5 } };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should handle zero', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.count', operator: 'greater_than', value: 0 },
      ];
      const context: Context = { custom_attributes: { count: 1 } };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should not match when attribute is missing', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.score', operator: 'greater_than', value: 50 },
      ];
      const context: Context = {};

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should not match when value is null', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.score', operator: 'greater_than', value: 50 },
      ];
      const context: Context = { custom_attributes: { score: null } };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should handle string comparison', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.version', operator: 'greater_than', value: '1.0.0' },
      ];
      const context: Context = { custom_attributes: { version: '2.0.0' } };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });
  });

  describe('less_than operator', () => {
    it('should match when value is less', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.score', operator: 'less_than', value: 50 },
      ];
      const context: Context = { custom_attributes: { score: 25 } };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should not match when value is equal', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.score', operator: 'less_than', value: 50 },
      ];
      const context: Context = { custom_attributes: { score: 50 } };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should not match when value is greater', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.score', operator: 'less_than', value: 50 },
      ];
      const context: Context = { custom_attributes: { score: 75 } };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should handle negative numbers', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.temperature', operator: 'less_than', value: -5 },
      ];
      const context: Context = { custom_attributes: { temperature: -10 } };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should handle zero', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.count', operator: 'less_than', value: 0 },
      ];
      const context: Context = { custom_attributes: { count: -1 } };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should not match when attribute is missing', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.score', operator: 'less_than', value: 50 },
      ];
      const context: Context = {};

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should not match when value is null', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.score', operator: 'less_than', value: 50 },
      ];
      const context: Context = { custom_attributes: { score: null } };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });
  });

  describe('regex_match operator', () => {
    it('should match when string matches pattern', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.email', operator: 'regex_match', value: '.*@example\\.com$' },
      ];
      const context: Context = { custom_attributes: { email: 'user@example.com' } };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should not match when string does not match pattern', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.email', operator: 'regex_match', value: '.*@example\\.com$' },
      ];
      const context: Context = { custom_attributes: { email: 'user@other.com' } };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should handle start anchor', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.version', operator: 'regex_match', value: '^v\\d+\\.\\d+\\.\\d+$' },
      ];
      const context: Context = { custom_attributes: { version: 'v1.2.3' } };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should handle character classes', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.code', operator: 'regex_match', value: '^[A-Z]{2}-\\d{4}$' },
      ];
      const context: Context = { custom_attributes: { code: 'US-1234' } };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should handle alternation', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.env', operator: 'regex_match', value: '^(prod|staging|dev)$' },
      ];
      const context: Context = { custom_attributes: { env: 'staging' } };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should not match when value is not a string', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.count', operator: 'regex_match', value: '\\d+' },
      ];
      const context: Context = { custom_attributes: { count: 123 } };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should not match when attribute is missing', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.email', operator: 'regex_match', value: '.*@example\\.com$' },
      ];
      const context: Context = {};

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should handle invalid regex pattern gracefully', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.text', operator: 'regex_match', value: '[invalid(' },
      ];
      const context: Context = { custom_attributes: { text: 'test' } };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should handle case-sensitive matching', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.text', operator: 'regex_match', value: '^Test$' },
      ];
      const context: Context = { custom_attributes: { text: 'test' } };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should handle partial matches', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.text', operator: 'regex_match', value: 'test' },
      ];
      const context: Context = { custom_attributes: { text: 'this is a test string' } };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });
  });

  describe('AND logic with multiple conditions', () => {
    it('should match when all conditions are true', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'equals', value: 'us-east-1' },
        { attribute: 'tier', operator: 'equals', value: 'premium' },
        { attribute: 'custom_attributes.score', operator: 'greater_than', value: 50 },
      ];
      const context: Context = {
        region: 'us-east-1',
        tier: 'premium',
        custom_attributes: { score: 75 },
      };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should not match when first condition fails', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'equals', value: 'us-east-1' },
        { attribute: 'tier', operator: 'equals', value: 'premium' },
      ];
      const context: Context = {
        region: 'us-west-2',
        tier: 'premium',
      };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should not match when middle condition fails', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'equals', value: 'us-east-1' },
        { attribute: 'tier', operator: 'equals', value: 'premium' },
        { attribute: 'custom_attributes.score', operator: 'greater_than', value: 50 },
      ];
      const context: Context = {
        region: 'us-east-1',
        tier: 'basic',
        custom_attributes: { score: 75 },
      };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should not match when last condition fails', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'equals', value: 'us-east-1' },
        { attribute: 'tier', operator: 'equals', value: 'premium' },
        { attribute: 'custom_attributes.score', operator: 'greater_than', value: 50 },
      ];
      const context: Context = {
        region: 'us-east-1',
        tier: 'premium',
        custom_attributes: { score: 25 },
      };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should handle empty conditions array (vacuous truth)', () => {
      const conditions: Condition[] = [];
      const context: Context = { region: 'us-east-1' };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });
  });

  describe('context attribute validation', () => {
    it('should handle top-level context attributes', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'equals', value: 'us-east-1' },
        { attribute: 'tier', operator: 'equals', value: 'premium' },
        { attribute: 'user_id', operator: 'equals', value: 'user-123' },
      ];
      const context: Context = {
        region: 'us-east-1',
        tier: 'premium',
        user_id: 'user-123',
      };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should handle nested custom_attributes', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.feature_flag', operator: 'equals', value: 'enabled' },
        { attribute: 'custom_attributes.user_segment', operator: 'equals', value: 'beta' },
      ];
      const context: Context = {
        custom_attributes: {
          feature_flag: 'enabled',
          user_segment: 'beta',
        },
      };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should handle missing top-level attributes', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'equals', value: 'us-east-1' },
      ];
      const context: Context = {
        tier: 'premium',
      };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should handle missing nested attributes', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.feature_flag', operator: 'equals', value: 'enabled' },
      ];
      const context: Context = {
        custom_attributes: {
          user_segment: 'beta',
        },
      };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should handle missing custom_attributes object', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.feature_flag', operator: 'equals', value: 'enabled' },
      ];
      const context: Context = {
        region: 'us-east-1',
      };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should handle empty context', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'equals', value: 'us-east-1' },
      ];
      const context: Context = {};

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should handle undefined attribute values', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'equals', value: undefined },
      ];
      const context: Context = {
        region: undefined,
      };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should handle null attribute values', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.value', operator: 'equals', value: null },
      ];
      const context: Context = {
        custom_attributes: { value: null },
      };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in string values', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.text', operator: 'equals', value: 'hello@world!#$%' },
      ];
      const context: Context = {
        custom_attributes: { text: 'hello@world!#$%' },
      };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should handle empty string values', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.text', operator: 'equals', value: '' },
      ];
      const context: Context = {
        custom_attributes: { text: '' },
      };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should handle very large numbers', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.count', operator: 'greater_than', value: 1000000 },
      ];
      const context: Context = {
        custom_attributes: { count: 1000001 },
      };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should handle floating point numbers', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.price', operator: 'greater_than', value: 19.99 },
      ];
      const context: Context = {
        custom_attributes: { price: 29.99 },
      };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should handle unicode characters', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.text', operator: 'equals', value: '你好世界' },
      ];
      const context: Context = {
        custom_attributes: { text: '你好世界' },
      };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should handle whitespace in values', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.text', operator: 'equals', value: '  spaces  ' },
      ];
      const context: Context = {
        custom_attributes: { text: '  spaces  ' },
      };

      expect(evaluateConditions(conditions, context)).toBe(true);
    });

    it('should not trim whitespace automatically', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.text', operator: 'equals', value: 'test' },
      ];
      const context: Context = {
        custom_attributes: { text: ' test ' },
      };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });

    it('should handle complex nested objects in custom_attributes', () => {
      const conditions: Condition[] = [
        { attribute: 'custom_attributes.config', operator: 'equals', value: { nested: 'value' } },
      ];
      const context: Context = {
        custom_attributes: { config: { nested: 'value' } },
      };

      // Object comparison by reference, not deep equality
      expect(evaluateConditions(conditions, context)).toBe(false);
    });
  });

  describe('unknown operator handling', () => {
    it('should return false for unknown operator', () => {
      const conditions: Condition[] = [
        { attribute: 'region', operator: 'unknown_operator' as any, value: 'us-east-1' },
      ];
      const context: Context = { region: 'us-east-1' };

      expect(evaluateConditions(conditions, context)).toBe(false);
    });
  });
});
