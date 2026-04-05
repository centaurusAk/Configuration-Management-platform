'use client';

import { Rule } from '../types/rules';
import { useState } from 'react';

interface RuleListProps {
  rules: Rule[];
  onReorder: (rules: Rule[]) => void;
  onEdit: (rule: Rule) => void;
  onDelete: (ruleId: string) => void;
}

export function RuleList({ rules, onReorder, onEdit, onDelete }: RuleListProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === index) return;

    const newRules = [...rules];
    const draggedRule = newRules[draggedIndex];
    
    // Remove from old position
    newRules.splice(draggedIndex, 1);
    // Insert at new position
    newRules.splice(index, 0, draggedRule);
    
    // Update priorities based on new order (highest priority first)
    const reorderedRules = newRules.map((rule, idx) => ({
      ...rule,
      priority: newRules.length - idx
    }));
    
    onReorder(reorderedRules);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const formatConditions = (rule: Rule): string => {
    if (rule.conditions.length === 0) return 'No conditions';
    
    return rule.conditions
      .map(c => `${c.attribute} ${c.operator} ${JSON.stringify(c.value)}`)
      .join(' AND ');
  };

  if (rules.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: '#666',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px dashed #d1d5db'
      }}>
        No rules defined. Create a rule to get started.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {rules.map((rule, index) => (
        <div
          key={rule.id}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
          style={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '1rem',
            cursor: 'move',
            opacity: draggedIndex === index ? 0.5 : 1,
            transition: 'opacity 0.2s'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <span style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151',
                  backgroundColor: '#f3f4f6',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px'
                }}>
                  Priority: {rule.priority}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  color: rule.enabled ? '#059669' : '#dc2626',
                  fontWeight: '500'
                }}>
                  {rule.enabled ? '● Enabled' : '● Disabled'}
                </span>
              </div>
              
              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>
                  Conditions:
                </span>
                <div style={{ fontSize: '0.875rem', color: '#374151', marginTop: '0.25rem' }}>
                  {formatConditions(rule)}
                </div>
              </div>
              
              <div>
                <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>
                  Target Value:
                </span>
                <span style={{ fontSize: '0.875rem', color: '#374151', marginLeft: '0.5rem' }}>
                  {JSON.stringify(rule.value)}
                </span>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
              <button
                onClick={() => onEdit(rule)}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  color: '#2563eb',
                  backgroundColor: 'white',
                  border: '1px solid #2563eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#eff6ff';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(rule.id)}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  color: '#dc2626',
                  backgroundColor: 'white',
                  border: '1px solid #dc2626',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#fef2f2';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
