'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { apiClient } from '../../../lib/api';
import { ConfirmDialog } from '../../../components/ConfirmDialog';

interface ApiKey {
  id: string;
  prefix: string;
  project_id: string;
  environment_id: string;
  created_at: string;
  expires_at: string | null;
  revoked: boolean;
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [environmentId, setEnvironmentId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [creating, setCreating] = useState(false);
  
  // Generated key display
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Revoke confirmation
  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null);

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // For demo purposes, using placeholder project/env IDs
      // In production, these would come from context/state
      const response = await apiClient.getApiKeys('project-1', 'production');
      setApiKeys(response.apiKeys || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const handleCreateApiKey = async () => {
    if (!projectId || !environmentId) {
      alert('Please fill in all required fields');
      return;
    }
    
    try {
      setCreating(true);
      const data: any = {
        projectId,
        environmentId,
      };
      
      if (expiresAt) {
        data.expiresAt = expiresAt;
      }
      
      const response = await apiClient.createApiKey(data);
      setGeneratedKey(response.key);
      setShowCreateForm(false);
      setProjectId('');
      setEnvironmentId('');
      setExpiresAt('');
      
      // Refresh the list
      await fetchApiKeys();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    try {
      await apiClient.revokeApiKey(id);
      setRevokeKeyId(null);
      await fetchApiKeys();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to revoke API key');
    }
  };

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>API Keys</h1>
        <button
          onClick={() => setShowCreateForm(true)}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500
          }}
        >
          Create API Key
        </button>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div style={{
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
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
          }}>
            <h2 style={{ marginTop: 0 }}>Create API Key</h2>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                Project ID *
              </label>
              <input
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="Enter project ID"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                Environment ID *
              </label>
              <input
                type="text"
                value={environmentId}
                onChange={(e) => setEnvironmentId(e.target.value)}
                placeholder="Enter environment ID"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                Expiration Date (Optional)
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '0.875rem'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreateForm(false)}
                disabled={creating}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: creating ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateApiKey}
                disabled={creating}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: creating ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: creating ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500
                }}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generated Key Display */}
      {generatedKey && (
        <div style={{
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
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '600px',
            width: '100%',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
          }}>
            <h2 style={{ marginTop: 0, color: '#059669' }}>API Key Created Successfully!</h2>
            
            <div style={{
              backgroundColor: '#fef3c7',
              border: '1px solid #fbbf24',
              borderRadius: '4px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#92400e' }}>
                <strong>Important:</strong> This is the only time you will see this key. Please copy it now and store it securely.
              </p>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                API Key
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={generatedKey}
                  readOnly
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                    backgroundColor: '#f9fafb'
                  }}
                />
                <button
                  onClick={handleCopyKey}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: copied ? '#059669' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setGeneratedKey(null)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Keys List */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '1.5rem', 
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        {loading && <p>Loading API keys...</p>}
        {error && <p style={{ color: '#ef4444' }}>{error}</p>}
        
        {!loading && !error && apiKeys.length === 0 && (
          <p>No API keys found. Create one to get started.</p>
        )}
        
        {!loading && !error && apiKeys.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Prefix</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Project ID</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Environment</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Created</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Expires</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((key) => (
                  <tr key={key.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>
                      {key.prefix}...
                    </td>
                    <td style={{ padding: '0.75rem' }}>{key.project_id}</td>
                    <td style={{ padding: '0.75rem' }}>{key.environment_id}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {new Date(key.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {key.expires_at ? new Date(key.expires_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        backgroundColor: key.revoked ? '#fee2e2' : '#d1fae5',
                        color: key.revoked ? '#991b1b' : '#065f46'
                      }}>
                        {key.revoked ? 'Revoked' : 'Active'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {!key.revoked && (
                        <button
                          onClick={() => setRevokeKeyId(key.id)}
                          style={{
                            padding: '0.25rem 0.75rem',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 500
                          }}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Revoke Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!revokeKeyId}
        title="Revoke API Key"
        message="Are you sure you want to revoke this API key? This action cannot be undone and applications using this key will no longer be able to authenticate."
        onConfirm={() => handleRevokeApiKey(revokeKeyId!)}
        onCancel={() => setRevokeKeyId(null)}
      />
    </DashboardLayout>
  );
}
