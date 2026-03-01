import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RuleTester from '../../../../components/RuleTester';
import { Context, RuleTestResult } from '../../../../types/context';

describe('RuleTester Integration Tests', () => {
  const mockConfigId = 'config-123';

  describe('Rule evaluation with various contexts', () => {
    it('should test rule evaluation with user_id context', async () => {
      const mockResult: RuleTestResult = {
        value: true,
        matched_rule: {
          id: 'rule-1',
          priority: 100,
          value: true,
          conditions: [{ attribute: 'user_id', operator: 'equals', value: 'user123' }],
        },
        default_value: false,
        evaluation_trace: [
          {
            rule_id: 'rule-1',
            priority: 100,
            matched: true,
          },
        ],
      };

      const mockOnTest = jest.fn().mockResolvedValue(mockResult);

      render(<RuleTester configId={mockConfigId} onTest={mockOnTest} />);

      // Fill in user_id
      const userIdInput = screen.getByLabelText(/User ID/i);
      fireEvent.change(userIdInput, { target: { value: 'user123' } });

      // Click test button
      const testButton = screen.getByRole('button', { name: /Test Rule Evaluation/i });
      fireEvent.click(testButton);

      // Wait for result
      await waitFor(() => {
        expect(mockOnTest).toHaveBeenCalledWith({
          user_id: 'user123',
        });
      });

      // Verify result is displayed
      await waitFor(() => {
        expect(screen.getByText(/Result/i)).toBeInTheDocument();
        expect(screen.getByText(/Rule ID:/i)).toBeInTheDocument();
        expect(screen.getAllByText(/rule-1/i).length).toBeGreaterThan(0);
      });
    });

    it('should test rule evaluation with multiple context attributes', async () => {
      const mockResult: RuleTestResult = {
        value: 'premium-feature',
        matched_rule: {
          id: 'rule-2',
          priority: 90,
          value: 'premium-feature',
          conditions: [
            { attribute: 'tier', operator: 'equals', value: 'premium' },
            { attribute: 'region', operator: 'equals', value: 'us-east-1' },
          ],
        },
        default_value: 'basic-feature',
        evaluation_trace: [
          {
            rule_id: 'rule-2',
            priority: 90,
            matched: true,
          },
        ],
      };

      const mockOnTest = jest.fn().mockResolvedValue(mockResult);

      render(<RuleTester configId={mockConfigId} onTest={mockOnTest} />);

      // Fill in multiple context fields
      fireEvent.change(screen.getByLabelText(/User ID/i), { target: { value: 'user456' } });
      fireEvent.change(screen.getByLabelText(/Region/i), { target: { value: 'us-east-1' } });
      fireEvent.change(screen.getByLabelText(/Tier/i), { target: { value: 'premium' } });
      fireEvent.change(screen.getByLabelText(/App Version/i), { target: { value: '2.0.0' } });

      // Click test button
      fireEvent.click(screen.getByRole('button', { name: /Test Rule Evaluation/i }));

      // Wait for result
      await waitFor(() => {
        expect(mockOnTest).toHaveBeenCalledWith({
          user_id: 'user456',
          region: 'us-east-1',
          tier: 'premium',
          app_version: '2.0.0',
        });
      });

      // Verify matched rule is displayed
      await waitFor(() => {
        expect(screen.getAllByText(/rule-2/i).length).toBeGreaterThan(0);
        expect(screen.getByText(/Priority: 90/i)).toBeInTheDocument();
      });
    });

    it('should test rule evaluation with custom attributes', async () => {
      const mockResult: RuleTestResult = {
        value: 'custom-value',
        matched_rule: {
          id: 'rule-3',
          priority: 80,
          value: 'custom-value',
          conditions: [{ attribute: 'custom_field', operator: 'equals', value: 'special' }],
        },
        default_value: 'default-value',
        evaluation_trace: [
          {
            rule_id: 'rule-3',
            priority: 80,
            matched: true,
          },
        ],
      };

      const mockOnTest = jest.fn().mockResolvedValue(mockResult);

      render(<RuleTester configId={mockConfigId} onTest={mockOnTest} />);

      // Add custom attribute
      const keyInput = screen.getAllByPlaceholderText(/Key/i)[0];
      const valueInput = screen.getAllByPlaceholderText(/Value/i)[0];
      
      fireEvent.change(keyInput, { target: { value: 'custom_field' } });
      fireEvent.change(valueInput, { target: { value: 'special' } });
      
      const addButton = screen.getByRole('button', { name: /Add/i });
      fireEvent.click(addButton);

      // Verify custom attribute is displayed
      expect(screen.getByText(/custom_field:/i)).toBeInTheDocument();
      expect(screen.getByText(/special/i)).toBeInTheDocument();

      // Click test button
      fireEvent.click(screen.getByRole('button', { name: /Test Rule Evaluation/i }));

      // Wait for result
      await waitFor(() => {
        expect(mockOnTest).toHaveBeenCalledWith({
          custom_attributes: {
            custom_field: 'special',
          },
        });
      });
    });
  });

  describe('Display of matched rules', () => {
    it('should display matched rule information correctly', async () => {
      const mockResult: RuleTestResult = {
        value: { enabled: true, limit: 100 },
        matched_rule: {
          id: 'rule-matched',
          priority: 95,
          value: { enabled: true, limit: 100 },
          conditions: [{ attribute: 'tier', operator: 'equals', value: 'premium' }],
        },
        default_value: { enabled: false, limit: 10 },
        evaluation_trace: [
          {
            rule_id: 'rule-matched',
            priority: 95,
            matched: true,
          },
        ],
      };

      const mockOnTest = jest.fn().mockResolvedValue(mockResult);

      render(<RuleTester configId={mockConfigId} onTest={mockOnTest} />);

      // Trigger test
      fireEvent.click(screen.getByRole('button', { name: /Test Rule Evaluation/i }));

      // Wait for matched rule display
      await waitFor(() => {
        expect(screen.getByText(/Matched Rule/i)).toBeInTheDocument();
        expect(screen.getByText(/Rule ID:/i)).toBeInTheDocument();
        expect(screen.getByText(/rule-matched/i)).toBeInTheDocument();
        expect(screen.getByText(/Priority: 95/i)).toBeInTheDocument();
      });

      // Verify result value is displayed
      expect(screen.getAllByText(/"enabled": true/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/"limit": 100/i).length).toBeGreaterThan(0);
    });

    it('should display evaluation trace with match status', async () => {
      const mockResult: RuleTestResult = {
        value: 'value-from-rule-2',
        matched_rule: {
          id: 'rule-2',
          priority: 80,
          value: 'value-from-rule-2',
          conditions: [],
        },
        default_value: 'default',
        evaluation_trace: [
          {
            rule_id: 'rule-1',
            priority: 100,
            matched: false,
            reason: 'Conditions did not match',
          },
          {
            rule_id: 'rule-2',
            priority: 80,
            matched: true,
          },
          {
            rule_id: 'rule-3',
            priority: 60,
            matched: false,
            reason: 'Not evaluated (higher priority rule matched)',
          },
        ],
      };

      const mockOnTest = jest.fn().mockResolvedValue(mockResult);

      render(<RuleTester configId={mockConfigId} onTest={mockOnTest} />);

      // Trigger test
      fireEvent.click(screen.getByRole('button', { name: /Test Rule Evaluation/i }));

      // Wait for evaluation trace
      await waitFor(() => {
        expect(screen.getByText(/Evaluation Trace/i)).toBeInTheDocument();
      });

      // Verify all rules in trace are displayed
      expect(screen.getByText(/✓ Matched/i)).toBeInTheDocument();
      expect(screen.getAllByText(/✗ Not matched/i)).toHaveLength(2);
      
      // Verify reasons are displayed
      expect(screen.getByText(/Conditions did not match/i)).toBeInTheDocument();
    });
  });

  describe('Display of default value when no match', () => {
    it('should display default value when no rules match', async () => {
      const mockResult: RuleTestResult = {
        value: 'default-config-value',
        matched_rule: null,
        default_value: 'default-config-value',
        evaluation_trace: [
          {
            rule_id: 'rule-1',
            priority: 100,
            matched: false,
            reason: 'User not in 50% rollout',
          },
          {
            rule_id: 'rule-2',
            priority: 80,
            matched: false,
            reason: 'Conditions did not match',
          },
        ],
      };

      const mockOnTest = jest.fn().mockResolvedValue(mockResult);

      render(<RuleTester configId={mockConfigId} onTest={mockOnTest} />);

      // Trigger test
      fireEvent.click(screen.getByRole('button', { name: /Test Rule Evaluation/i }));

      // Wait for result
      await waitFor(() => {
        expect(screen.getByText(/No rule matched/i)).toBeInTheDocument();
        expect(screen.getByText(/Returned default value:/i)).toBeInTheDocument();
      });

      // Verify default value is displayed
      expect(screen.getAllByText(/default-config-value/i).length).toBeGreaterThan(0);

      // Verify all rules show as not matched
      const notMatchedElements = screen.getAllByText(/✗ Not matched/i);
      expect(notMatchedElements).toHaveLength(2);
    });

    it('should explain why no rules matched', async () => {
      const mockResult: RuleTestResult = {
        value: false,
        matched_rule: null,
        default_value: false,
        evaluation_trace: [
          {
            rule_id: 'rule-1',
            priority: 100,
            matched: false,
            reason: 'No user_id in context for percentage rollout',
          },
          {
            rule_id: 'rule-2',
            priority: 90,
            matched: false,
            reason: 'Conditions did not match',
          },
          {
            rule_id: 'rule-3',
            priority: 80,
            matched: false,
            reason: 'Non-percentage conditions did not match',
          },
        ],
      };

      const mockOnTest = jest.fn().mockResolvedValue(mockResult);

      render(<RuleTester configId={mockConfigId} onTest={mockOnTest} />);

      // Trigger test
      fireEvent.click(screen.getByRole('button', { name: /Test Rule Evaluation/i }));

      // Wait for evaluation trace
      await waitFor(() => {
        expect(screen.getByText(/Evaluation Trace/i)).toBeInTheDocument();
      });

      // Verify reasons are displayed for each rule
      expect(screen.getByText(/No user_id in context for percentage rollout/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Conditions did not match/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Non-percentage conditions did not match/i)).toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('should display error message when test fails', async () => {
      const mockOnTest = jest.fn().mockRejectedValue(new Error('Network error'));

      render(<RuleTester configId={mockConfigId} onTest={mockOnTest} />);

      // Trigger test
      fireEvent.click(screen.getByRole('button', { name: /Test Rule Evaluation/i }));

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Custom attribute management', () => {
    it('should allow adding and removing custom attributes', async () => {
      const mockOnTest = jest.fn().mockResolvedValue({
        value: 'test',
        matched_rule: null,
        default_value: 'test',
        evaluation_trace: [],
      });

      render(<RuleTester configId={mockConfigId} onTest={mockOnTest} />);

      // Add first custom attribute
      const keyInputs = screen.getAllByPlaceholderText(/Key/i);
      const valueInputs = screen.getAllByPlaceholderText(/Value/i);
      
      fireEvent.change(keyInputs[0], { target: { value: 'attr1' } });
      fireEvent.change(valueInputs[0], { target: { value: 'value1' } });
      fireEvent.click(screen.getByRole('button', { name: /Add/i }));

      // Verify first attribute is displayed
      expect(screen.getByText(/attr1:/i)).toBeInTheDocument();
      expect(screen.getByText(/value1/i)).toBeInTheDocument();

      // Add second custom attribute
      fireEvent.change(keyInputs[0], { target: { value: 'attr2' } });
      fireEvent.change(valueInputs[0], { target: { value: 'value2' } });
      fireEvent.click(screen.getByRole('button', { name: /Add/i }));

      // Verify both attributes are displayed
      expect(screen.getByText(/attr2:/i)).toBeInTheDocument();
      expect(screen.getByText(/value2/i)).toBeInTheDocument();

      // Remove first attribute
      const removeButtons = screen.getAllByRole('button', { name: /Remove/i });
      fireEvent.click(removeButtons[0]);

      // Verify first attribute is removed
      await waitFor(() => {
        expect(screen.queryByText(/attr1:/i)).not.toBeInTheDocument();
      });

      // Verify second attribute still exists
      expect(screen.getByText(/attr2:/i)).toBeInTheDocument();
    });
  });
});
