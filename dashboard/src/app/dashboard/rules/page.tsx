'use client';

import { DashboardLayout } from '../../../components/DashboardLayout';
import { RuleList } from '../../../components/RuleList';
import { RuleEditor } from '../../../components/RuleEditor';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import RuleTester from '../../../components/RuleTester';
import { Rule, RuleFormData } from '../../../types/rules';
import { Context, RuleTestResult } from '../../../types/context';
import { useState, useEffect } from 'react';
import { apiClient } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';

export default function RulesPage() {
  const { token } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    ruleId: string | null;
    rulePriority: number | null;
  }>({
    isOpen: false,
    ruleId: null,
    rulePriority: null
  });
  const [showTester, setShowTester] = useState(false);

  useEffect(() => {
    if (token) {
      apiClient.setToken(token);
    }
  }, [token]);

  useEffect(() => {
    if (selectedConfigId) {
      loadRules();
    }
  }, [selectedConfigId]);

  const loadRules = async () => {
    if (!selectedConfigId) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getRules(selectedConfigId);
      // Sort by priority descending (highest first)
      const sortedRules = data.sort((a: Rule, b: Rule) => b.priority - a.priority);
      setRules(sortedRules);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  };

  const validateRuleData = (ruleData: RuleFormData): string | null => {
    // Validate all conditions are complete
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

  const handleSaveRule = async (ruleData: RuleFormData) => {
    // Validate rule data
    const validationError = validateRuleData(ruleData);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (editingRule) {
        // Update existing rule
        await apiClient.updateRule(editingRule.id, ruleData);
        setSuccessMessage('Rule updated successfully');
      } else {
        // Create new rule
        await apiClient.createRule(ruleData);
        setSuccessMessage('Rule created successfully');
      }
      
      // Reload rules
      await loadRules();
      
      // Close editor
      setEditingRule(null);
      setIsCreating(false);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save rule');
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = async (reorderedRules: Rule[]) => {
    setRules(reorderedRules);
    
    // Update priorities on backend
    try {
      for (const rule of reorderedRules) {
        await apiClient.updateRule(rule.id, {
          config_key_id: rule.config_key_id,
          priority: rule.priority,
          conditions: rule.conditions,
          value: rule.value,
          enabled: rule.enabled
        });
      }
      setSuccessMessage('Rule priorities updated');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update rule priorities');
      // Reload to get correct state
      await loadRules();
    }
  };

  const handleEdit = (rule: Rule) => {
    setEditingRule(rule);
    setIsCreating(false);
  };

  const handleDelete = async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    setDeleteConfirmation({
      isOpen: true,
      ruleId,
      rulePriority: rule?.priority || null
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation.ruleId) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await apiClient.deleteRule(deleteConfirmation.ruleId);
      setSuccessMessage('Rule deleted successfully');
      
      // Reload rules
      await loadRules();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to delete rule');
    } finally {
      setLoading(false);
      setDeleteConfirmation({ isOpen: false, ruleId: null, rulePriority: null });
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmation({ isOpen: false, ruleId: null, rulePriority: null });
  };

  const handleCancel = () => {
    setEditingRule(null);
    setIsCreating(false);
    setError(null);
  };

  const handleTestRule = async (context: Context): Promise<RuleTestResult> => {
    return await apiClient.testRule(selectedConfigId, context);
  };

  return (
    <DashboardLayout>
      <h1 style={{ marginTop: 0 }}>Rule Management</h1>

      {/* Config Selection */}
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '1.5rem'
      }}>
        <label style={{
          display: 'block',
          fontSize: '0.875rem',
          fontWeight: '500',
          color: '#374151',
          marginBottom: '0.5rem'
        }}>
          Select Configuration Key
        </label>
        <input
          type="text"
          value={selectedConfigId}
          onChange={(e) => setSelectedConfigId(e.target.value)}
          placeholder="Enter config key ID"
          style={{
            width: '100%',
            padding: '0.5rem',
            fontSize: '0.875rem',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            outline: 'none'
          }}
        />
        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
          Enter the configuration key ID to manage its rules
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#dc2626',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          fontSize: '0.875rem'
        }}>
          {error}
        </div>
      )}

      {successMessage && (
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          color: '#16a34a',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          fontSize: '0.875rem'
        }}>
          {successMessage}
        </div>
      )}

      {selectedConfigId && (
        <>
          {/* Create Rule Button */}
          {!isCreating && !editingRule && (
            <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setIsCreating(true)}
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.875rem',
                  color: 'white',
                  backgroundColor: loading ? '#9ca3af' : '#2563eb',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '500'
                }}
              >
                + Create New Rule
              </button>
              <button
                onClick={() => setShowTester(!showTester)}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.875rem',
                  color: '#2563eb',
                  backgroundColor: 'white',
                  border: '1px solid #2563eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                {showTester ? 'Hide' : 'Show'} Rule Tester
              </button>
            </div>
          )}

          {/* Rule Editor */}
          {(isCreating || editingRule) && (
            <RuleEditor
              rule={editingRule || undefined}
              configKeyId={selectedConfigId}
              onSave={handleSaveRule}
              onCancel={handleCancel}
            />
          )}

          {/* Rule Tester */}
          {showTester && !isCreating && !editingRule && (
            <div style={{ marginBottom: '1.5rem' }}>
              <RuleTester
                configId={selectedConfigId}
                onTest={handleTestRule}
              />
            </div>
          )}

          {/* Rule List */}
          {!isCreating && !editingRule && (
            <div style={{
              backgroundColor: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>
                Rules (Priority Order)
              </h2>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                  Loading rules...
                </div>
              ) : (
                <RuleList
                  rules={rules}
                  onReorder={handleReorder}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmation.isOpen}
        title="Delete Rule"
        message={`Are you sure you want to delete this rule${deleteConfirmation.rulePriority ? ` (Priority: ${deleteConfirmation.rulePriority})` : ''}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </DashboardLayout>
  );
}
