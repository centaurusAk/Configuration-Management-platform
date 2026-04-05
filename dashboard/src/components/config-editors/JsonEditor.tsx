'use client';

import { useState, useEffect } from 'react';

interface JsonEditorProps {
  value: any;
  onChange: (value: any) => void;
}

export function JsonEditor({ value, onChange }: JsonEditorProps) {
  const [textValue, setTextValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setTextValue(JSON.stringify(value, null, 2));
      setError(null);
    } catch (e) {
      setError('Invalid JSON value');
    }
  }, [value]);

  const handleChange = (newText: string) => {
    setTextValue(newText);
    
    try {
      const parsed = JSON.parse(newText);
      onChange(parsed);
      setError(null);
    } catch (e) {
      setError('Invalid JSON syntax');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <textarea
        value={textValue}
        onChange={(e) => handleChange(e.target.value)}
        rows={10}
        style={{
          width: '100%',
          padding: '0.75rem',
          border: error ? '1px solid #ef4444' : '1px solid #ddd',
          borderRadius: '4px',
          fontSize: '0.875rem',
          fontFamily: 'monospace',
          resize: 'vertical',
          backgroundColor: error ? '#fef2f2' : 'white'
        }}
      />
      {error && (
        <span style={{ fontSize: '0.875rem', color: '#ef4444' }}>
          {error}
        </span>
      )}
    </div>
  );
}
