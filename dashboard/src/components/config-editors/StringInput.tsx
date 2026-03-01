'use client';

interface StringInputProps {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}

export function StringInput({ value, onChange, multiline = false }: StringInputProps) {
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        style={{
          width: '100%',
          padding: '0.75rem',
          border: '1px solid #ddd',
          borderRadius: '4px',
          fontSize: '1rem',
          fontFamily: 'inherit',
          resize: 'vertical'
        }}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '0.75rem',
        border: '1px solid #ddd',
        borderRadius: '4px',
        fontSize: '1rem'
      }}
    />
  );
}
