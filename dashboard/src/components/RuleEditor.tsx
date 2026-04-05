'use client';

import { Rule, Condition, RuleOperator, RuleFormData } from '../types/rules';
import { useState, useEffect } from 'react';

interface RuleEditorProps {
  rule?: Rule;
  configKeyId: string;
  onSave: (ruleData: RuleFormData) => void;
  onCancel: () => void;
}

const OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'in_list', label: 'In List' },
  { value: 'not_in_list', label: 'Not In List' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'regex_match', label: 'Regex Match' },
];

const COMMON_ATTRIBUTES = [
  'user_id',
  'region',
  'app_version',
  'tier',
];

export function RuleEditor({ rule, configKeyId, onSave, onCancel }: RuleEditorProps) {
  const [priority, setPriority] = useState<number>(rule?.priority || 1);
  const [conditions, setConditions] = useState<Condition[]>(
    rule?.conditions || [{ attribute: '', operator: 'equals', value: '' }]
  );
  const [value, setValue] = useState<string>(
    rule?.value !== undefined ? JSON.stringify(rule.value) : ''
  );
  const [enabled, setEnabled] = useState<boolean>(rule?.enabled ?? true);

  const handleAddCondition = () => {
    setConditions([...conditions, { attribute: '', operator: 'equals', value: '' }]);
  };

  const handleRemoveCondition = (index: number) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((_, i) => i !== index));
    }
  };

  const handleConditionChange = (
    index: number,
    field: keyof Condition,
    value: any
  ) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], [field]: value };
    setConditions(newConditions);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let parsedValue: any;
    try {
      parsedValue = JSON.parse(value);
    } catch (error) {
      alert('Invalid JSON value');
      return;
    }

    const ruleData: RuleFormData = {
      config_key_id: configKeyId,
      priority,
      conditions,
      value: parsedValue,
      enabled,
    };

    onSave(ruleData);
  };

  return (
    <div style={{
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '1.5rem',
      marginTop: '1rem'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.125rem', fontWeight: '600' }}>
        {rule ? 'Edit Rule' : 'Create New Rule'}
      </h3>

      <form onSubmit={handleSubmit}>
        {/* Priority */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Priority
          </label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value))}
            min="1"
            required
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '0.875rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              outline: 'none'
            }}
          />
          <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
            Higher priority rules are evaluated first
          </p>
        </div>

        {/* Conditions */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <label style={{
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151'
            }}>
              Conditions (All must match - AND logic)
            </label>
            <button
              type="button"
              onClick={handleAddCondition}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.75rem',
                color: '#2563eb',
                backgroundColor: '#eff6ff',
                border: '1px solid #2563eb',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              + Add Condition
            </button>
          </div>

          {conditions.map((condition, index) => (
            <div
              key={index}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr auto',
                gap: '0.5rem',
                marginBottom: '0.75rem',
                padding: '0.75rem',
                backgroundColor: '#f9fafb',
                borderRadius: '6px'
              }}
            >
              {/* Attribute */}
              <div>
                <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                  Attribute
                </label>
                <input
                  type="text"
                  list={`attributes-${index}`}
                  value={condition.attribute}
                  onChange={(e) => handleConditionChange(index, 'attribute', e.target.value)}
                  placeholder="e.g., user_id"
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '0.875rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    outline: 'none'
                  }}
                />
                <datalist id={`attributes-${index}`}>
                  {COMMON_ATTRIBUTES.map(attr => (
                    <option key={attr} value={attr} />
                  ))}
                </datalist>
              </div>

              {/* Operator */}
              <div>
                <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                  Operator
                </label>
                <select
                  value={condition.operator}
                  onChange={(e) => handleConditionChange(index, 'operator', e.target.value as RuleOperator)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '0.875rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    outline: 'none',
                    backgroundColor: 'white'
                  }}
                >
                  {OPERATORS.map(op => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Value */}
              <div>
                <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                  Value
                </label>
                <input
                  type="text"
                  value={condition.value}
                  onChange={(e) => handleConditionChange(index, 'value', e.target.value)}
                  placeholder="Value"
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '0.875rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Remove button */}
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => handleRemoveCondition(index)}
                  disabled={conditions.length === 1}
                  style={{
                    padding: '0.5rem',
                    fontSize: '0.875rem',
                    color: conditions.length === 1 ? '#9ca3af' : '#dc2626',
                    backgroundColor: 'white',
                    border: `1px solid ${conditions.length === 1 ? '#d1d5db' : '#dc2626'}`,
                    borderRadius: '6px',
                    cursor: conditions.length === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Target Value */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Target Value (JSON)
          </label>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder='e.g., true, "value", 42, {"key": "value"}'
            required
            rows={3}
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '0.875rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              outline: 'none',
              fontFamily: 'monospace'
            }}
          />
          <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
            Enter the value to return when this rule matches (must be valid JSON)
          </p>
        </div>

        {/* Enabled */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              style={{ marginRight: '0.5rem', cursor: 'pointer' }}
            />
            Rule Enabled
          </label>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              color: '#374151',
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              color: 'white',
              backgroundColor: '#2563eb',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            {rule ? 'Update Rule' : 'Create Rule'}
          </button>
        </div>
      </form>
    </div>
  );
}
