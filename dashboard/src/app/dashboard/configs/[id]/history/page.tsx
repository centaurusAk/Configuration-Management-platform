'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { DashboardLayout } from '../../../../../components/DashboardLayout';
import { apiClient } from '../../../../../lib/api';
import { VersionHistory } from '../../../../../components/VersionHistory';
import { useAuth } from '../../../../../contexts/AuthContext';

interface ConfigKey {
  id: string;
  key_name: string;
  value_type: string;
  current_value: any;
}

interface ConfigVersion {
  id: string;
  config_key_id: string;
  value: any;
  created_by: string;
  created_at: string;
  version_number: number;
}

export default function ConfigHistoryPage() {
  const params = useParams();
  const configId = params.id as string;
  const { user } = useAuth();
  
  const [config, setConfig] = useState<ConfigKey | null>(null);
  const [versions, setVersions] = useState<ConfigVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [configId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [configData, versionsData] = await Promise.all([
        apiClient.getConfig(configId),
        apiClient.getVersionHistory(configId)
      ]);
      
      setConfig(configData);
      setVersions(versionsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (versionId: string) => {
    try {
      await apiClient.rollbackConfig(configId, versionId, user?.id || 'unknown');
      await loadData();
      alert('Configuration rolled back successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || err.message || 'Failed to rollback configuration');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Loading version history...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
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
            onClick={() => window.location.href = `/dashboard/configs/${configId}`}
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
            ← Back to Config
          </button>
          <h1 style={{ margin: 0 }}>Version History</h1>
          {config && (
            <p style={{ color: '#666', marginTop: '0.5rem' }}>
              Configuration: <strong>{config.key_name}</strong>
            </p>
          )}
        </div>

        <VersionHistory
          versions={versions}
          valueType={config?.value_type || 'string'}
          onRollback={handleRollback}
        />
      </div>
    </DashboardLayout>
  );
}
