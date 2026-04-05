'use client';

interface BooleanToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function BooleanToggle({ value, onChange }: BooleanToggleProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <button
        onClick={() => onChange(!value)}
        style={{
          position: 'relative',
          width: '60px',
          height: '32px',
          backgroundColor: value ? '#1976d2' : '#ccc',
          border: 'none',
          borderRadius: '16px',
          cursor: 'pointer',
          transition: 'background-color 0.2s'
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '4px',
            left: value ? '32px' : '4px',
            width: '24px',
            height: '24px',
            backgroundColor: 'white',
            borderRadius: '50%',
            transition: 'left 0.2s'
          }}
        />
      </button>
      <span style={{ fontSize: '1rem', fontWeight: 500 }}>
        {value ? 'True' : 'False'}
      </span>
    </div>
  );
}
