import { Condition, Context } from '../types/models';

/**
 * Evaluates all conditions against a context using AND logic
 * All conditions must match for the function to return true
 * 
 * Requirements: 4.5, 4.6
 * 
 * @param conditions - Array of conditions to evaluate
 * @param context - Context object containing attributes to match against
 * @returns true if all conditions match, false otherwise
 */
export function evaluateConditions(
  conditions: Condition[],
  context: Context,
): boolean {
  // All conditions must match (AND logic) - Requirement 4.6
  for (const condition of conditions) {
    const contextValue = getContextValue(context, condition.attribute);

    if (!evaluateCondition(condition, contextValue)) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluates a single condition against a context value
 * Supports all operators: equals, not_equals, in_list, not_in_list, 
 * greater_than, less_than, regex_match
 * 
 * Requirements: 4.5
 * 
 * @param condition - The condition to evaluate
 * @param contextValue - The value from the context
 * @returns true if the condition matches, false otherwise
 */
function evaluateCondition(condition: Condition, contextValue: any): boolean {
  switch (condition.operator) {
    case 'equals':
      return contextValue === condition.value;

    case 'not_equals':
      return contextValue !== condition.value;

    case 'in_list':
      // condition.value should be an array
      if (!Array.isArray(condition.value)) {
        return false;
      }
      return condition.value.includes(contextValue);

    case 'not_in_list':
      // condition.value should be an array
      if (!Array.isArray(condition.value)) {
        return false;
      }
      return !condition.value.includes(contextValue);

    case 'greater_than':
      // Both values should be comparable (numbers or strings)
      if (contextValue === undefined || contextValue === null) {
        return false;
      }
      return contextValue > condition.value;

    case 'less_than':
      // Both values should be comparable (numbers or strings)
      if (contextValue === undefined || contextValue === null) {
        return false;
      }
      return contextValue < condition.value;

    case 'regex_match':
      // contextValue should be a string, condition.value should be a regex pattern
      if (typeof contextValue !== 'string') {
        return false;
      }
      try {
        const regex = new RegExp(condition.value);
        return regex.test(contextValue);
      } catch (error) {
        // Invalid regex pattern
        return false;
      }

    default:
      // Unknown operator
      return false;
  }
}

/**
 * Retrieves a value from the context by attribute path
 * Supports nested attributes using dot notation (e.g., "custom_attributes.feature_flag")
 * 
 * @param context - The context object
 * @param attribute - The attribute path (supports dot notation)
 * @returns The value at the attribute path, or undefined if not found
 */
function getContextValue(context: Context, attribute: string): any {
  // Handle direct attributes
  if (attribute in context) {
    return context[attribute as keyof Context];
  }

  // Handle nested attributes in custom_attributes
  if (attribute.startsWith('custom_attributes.')) {
    const nestedKey = attribute.substring('custom_attributes.'.length);
    return context.custom_attributes?.[nestedKey];
  }

  return undefined;
}
