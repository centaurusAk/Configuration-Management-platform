'use client';

interface NumberSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function NumberSlider({ value, onChange, min = 0, max = 100, step = 1 }: NumberSliderProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <input
          type="range"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          style={{
            flex: 1,
            height: '6px',
            borderRadius: '3px',
            outline: 'none',
            cursor: 'pointer'
          }}
        />
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          style={{
            width: '80px',
            padding: '0.5rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '1rem',
            textAlign: 'center'
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#666' }}>
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
