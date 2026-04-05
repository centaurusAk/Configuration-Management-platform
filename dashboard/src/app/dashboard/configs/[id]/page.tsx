'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { DashboardLayout } from '../../../../components/DashboardLayout';
import { apiClient } from '../../../../lib/api';
import { BooleanToggle } from '../../../../components/config-editors/BooleanToggle';
import { NumberSlider } from '../../../../components/config-editors/NumberSlider';
import { StringInput } from '../../../../components/config-editors/StringInput';
import { JsonEditor } from '../../../../components/config-editors/JsonEditor';

interface ConfigKey {
  id: string;
  key_name: string;
  value_type: 'boolean' | 'string' | 'number' | 'json';
  current_value: any;
  environment_id: string;
  project_id: string;
  schema?: any;
  created_at: string;
  updated_at: string;
}

export default function ConfigDetailPage() {
  const params = useParams();
  const configId = params.id as string;
  
  const [config, setConfig] = useState<ConfigKey | null>(null);
  const [value, setValue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [configId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getConfig(configId);
      setConfig(data);
      setValue(data.current_value);
    } catch (err: any) {
      setError(err.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const validateValue = (newValue: any): boolean => {
    setValidationError(null);

    // Type validation
    if (config?.value_type === 'number' && isNaN(Number(newValue))) {
      setValidationError('Value must be a valid number');
      return false;
    }

    if (config?.value_type === 'boolean' && typeof newValue !== 'boolean') {
      setValidationError('Value must be a boolean');
      return false;
    }

    if (config?.value_type === 'json') {
      try {
        if (typeof newValue === 'string') {
          JSON.parse(newValue);
        }
      } catch (e) {
        setValidationError('Invalid JSON format');
        return false;
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateValue(value)) {
      return;
    }

    setShowConfirmation(true);
  };

  const confirmSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setShowConfirmation(false);

      await apiClient.updateConfig(configId, { value });
      await loadConfig();
      
      alert('Configuration updated successfully!');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const renderEditor = () => {
    if (!config) return null;

    switch (config.value_type) {
      case 'boolean':
        return (
          <BooleanToggle
            value={value}
            onChange={setValue}
          />
        );
      case 'number':
        return (
          <NumberSlider
            value={value}
            onChange={setValue}
            min={0}
            max={100}
          />
        );
      case 'string':
        return (
          <StringInput
            value={value}
            onChange={setValue}
          />
        );
      case 'json':
        return (
          <JsonEditor
            value={value}
            onChange={setValue}
          />
        );
      default:
        return <p>Unsupported value type</p>;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Loading configuration...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error && !config) {
    return (
      <DashboardLayout>
        <div style={{
          padding: '1rem',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c00'
        }}>
          {error}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div>
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => window.history.back()}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              color: '#666',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '1rem'
            }}
          >
            ← Back
          </button>
          <h1 style={{ margin: 0 }}>Edit Configuration</h1>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          {/* Config Metadata */}
          <div style={{ marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid #eee' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Key:</strong> {config?.key_name}
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Type:</strong>{' '}
              <span style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: '#e3f2fd',
                borderRadius: '4px',
                fontSize: '0.875rem'
              }}>
                {config?.value_type}
              </span>
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Environment:</strong> {config?.environment_id}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
              Last updated: {config && new Date(config.updated_at).toLocaleString()}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '4px',
              color: '#c00',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          {/* Validation Error Display */}
          {validationError && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '4px',
              color: '#856404',
              marginBottom: '1rem'
            }}>
              {validationError}
            </div>
          )}

          {/* Editor */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
              Value
            </label>
            {renderEditor()}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={handleSave}
              disabled={saving || !!validationError}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: validationError ? '#ccc' : '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: validationError ? 'not-allowed' : 'pointer',
                fontSize: '1rem'
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => window.location.href = `/dashboard/configs/${configId}/history`}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'transparent',
                color: '#1976d2',
                border: '1px solid #1976d2',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              View History
            </button>
          </div>
        </div>

        {/* Confirmation Dialog */}
        {showConfirmation && (
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
              <h3 style={{ marginTop: 0 }}>Confirm Changes</h3>
              <p>Are you sure you want to update this configuration?</p>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button
                  onClick={confirmSave}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Confirm
                </button>
                <button
                  onClick={() => setShowConfirmation(false)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: 'transparent',
                    color: '#666',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
