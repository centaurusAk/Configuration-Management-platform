'use client';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger'
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const variantColors = {
    danger: {
      button: '#dc2626',
      buttonHover: '#b91c1c',
      border: '#fecaca'
    },
    warning: {
      button: '#f59e0b',
      buttonHover: '#d97706',
      border: '#fde68a'
    },
    info: {
      button: '#2563eb',
      buttonHover: '#1d4ed8',
      border: '#bfdbfe'
    }
  };

  const colors = variantColors[variant];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{
          marginTop: 0,
          marginBottom: '1rem',
          fontSize: '1.125rem',
          fontWeight: '600',
          color: '#111827'
        }}>
          {title}
        </h3>
        
        <p style={{
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          color: '#6b7280',
          lineHeight: '1.5'
        }}>
          {message}
        </p>

        <div style={{
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'flex-end'
        }}>
          <button
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
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              color: 'white',
              backgroundColor: colors.button,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = colors.buttonHover;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = colors.button;
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
