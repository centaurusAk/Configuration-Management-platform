'use client';

import { useState } from 'react';

interface ConfigVersion {
  id: string;
  config_key_id: string;
  value: any;
  created_by: string;
  created_at: string;
  version_number: number;
}

interface VersionHistoryProps {
  versions: ConfigVersion[];
  valueType: string;
  onRollback: (versionId: string) => Promise<void>;
}

export function VersionHistory({ versions, valueType, onRollback }: VersionHistoryProps) {
  const [rollbackVersion, setRollbackVersion] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);

  const formatValue = (value: any, type: string) => {
    if (type === 'json') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const handleRollbackClick = (versionId: string) => {
    setRollbackVersion(versionId);
  };

  const confirmRollback = async () => {
    if (rollbackVersion === null) return;

    try {
      setRolling(true);
      await onRollback(rollbackVersion);
      setRollbackVersion(null);
    } catch (err) {
      // Error handled by parent
    } finally {
      setRolling(false);
    }
  };

  if (versions.length === 0) {
    return (
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        textAlign: 'center',
        color: '#666'
      }}>
        No version history available
      </div>
    );
  }

  return (
    <>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {versions.map((version, index) => (
          <div
            key={version.id}
            style={{
              padding: '1.5rem',
              borderBottom: index < versions.length - 1 ? '1px solid #eee' : 'none'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: index === 0 ? '#4caf50' : '#e3f2fd',
                    color: index === 0 ? 'white' : '#1976d2',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    {index === 0 ? 'CURRENT' : `v${version.version_number}`}
                  </span>
                  <span style={{ fontSize: '0.875rem', color: '#666' }}>
                    {new Date(version.created_at).toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>
                  Updated by: {version.created_by}
                </div>
              </div>
              {index > 0 && (
                <button
                  onClick={() => handleRollbackClick(version.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'transparent',
                    color: '#1976d2',
                    border: '1px solid #1976d2',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  Rollback
                </button>
              )}
            </div>
            <div style={{
              padding: '1rem',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              fontFamily: valueType === 'json' ? 'monospace' : 'inherit',
              fontSize: '0.875rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {formatValue(version.value, valueType)}
            </div>
          </div>
        ))}
      </div>

      {/* Rollback Confirmation Dialog */}
      {rollbackVersion !== null && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '400px',
            width: '100%'
          }}>
            <h3 style={{ marginTop: 0 }}>Confirm Rollback</h3>
            <p>
              Are you sure you want to rollback to version {rollbackVersion}? 
              This will create a new version with the selected value.
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                onClick={confirmRollback}
                disabled={rolling}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: rolling ? 'not-allowed' : 'pointer'
                }}
              >
                {rolling ? 'Rolling back...' : 'Confirm'}
              </button>
              <button
                onClick={() => setRollbackVersion(null)}
                disabled={rolling}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: 'transparent',
                  color: '#666',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: rolling ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
