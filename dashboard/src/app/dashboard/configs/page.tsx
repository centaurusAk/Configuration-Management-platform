'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { ImportExport } from '../../../components/ImportExport';
import { apiClient } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';

interface ConfigKey {
  id: string;
  key_name: string;
  value_type: 'boolean' | 'string' | 'number' | 'json';
  current_value: any;
  environment_id: string;
  project_id: string;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: string;
  name: string;
}

interface Environment {
  id: string;
  name: string;
}

export default function ConfigsPage() {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<ConfigKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Project/Environment state
  const [projects, setProjects] = useState<Project[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('');

  useEffect(() => {
    loadProjects();
    loadConfigs();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadEnvironments(selectedProject);
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    try {
      const data = await apiClient.getProjects();
      setProjects(data);
      if (data.length > 0) {
        setSelectedProject(data[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load projects:', err);
    }
  };

  const loadEnvironments = async (projectId: string) => {
    try {
      const data = await apiClient.getEnvironments(projectId);
      setEnvironments(data);
      if (data.length > 0) {
        setSelectedEnvironment(data[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load environments:', err);
    }
  };

  const loadConfigs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getConfigs();
      setConfigs(data);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load configurations');
    } finally {
      setLoading(false);
    }
  };

  const filteredConfigs = configs.filter(config => {
    const matchesSearch = config.key_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || config.value_type === filterType;
    // Filter by selected project/environment if available
    const matchesProject = !selectedProject || config.project_id === selectedProject;
    const matchesEnv = !selectedEnvironment || config.environment_id === selectedEnvironment;
    return matchesSearch && matchesType && matchesProject && matchesEnv;
  });

  const formatValue = (value: any, type: string) => {
    if (type === 'json') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  const selectedProjectName = projects.find(p => p.id === selectedProject)?.name || '';
  const selectedEnvName = environments.find(e => e.id === selectedEnvironment)?.name || '';

  return (
    <DashboardLayout>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ margin: 0 }}>Configurations</h1>
          <button
            onClick={() => window.location.href = '/dashboard/configs/new'}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            + New Configuration
          </button>
        </div>

        {/* Project/Environment Selector */}
        <div style={{
          backgroundColor: 'white',
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: '1.5rem',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Project</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.875rem' }}
            >
              <option value="">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Environment</label>
            <select
              value={selectedEnvironment}
              onChange={(e) => setSelectedEnvironment(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.875rem' }}
            >
              <option value="">All Environments</option>
              {environments.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Import/Export Component */}
        {selectedProject && selectedEnvironment && (
          <ImportExport
            projectId={selectedProject}
            environmentId={selectedEnvironment}
            onImportComplete={loadConfigs}
          />
        )}

        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          {/* Search and Filter Controls */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <input
              type="text"
              placeholder="Search configurations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
                minWidth: '150px'
              }}
            >
              <option value="all">All Types</option>
              <option value="boolean">Boolean</option>
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="json">JSON</option>
            </select>
          </div>

          {/* Loading State */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p>Loading configurations...</p>
            </div>
          )}

          {/* Error State */}
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

          {/* Config List */}
          {!loading && !error && (
            <>
              {filteredConfigs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                  {searchTerm || filterType !== 'all' 
                    ? 'No configurations match your filters'
                    : 'No configurations yet. Create your first one!'}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #ddd' }}>
                      <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: 600 }}>Key</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: 600 }}>Type</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: 600 }}>Current Value</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: 600 }}>Updated</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem', fontWeight: 600 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredConfigs.map((config) => (
                      <tr key={config.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.75rem' }}>
                          <a
                            href={`/dashboard/configs/${config.id}`}
                            style={{ color: '#1976d2', textDecoration: 'none' }}
                          >
                            {config.key_name}
                          </a>
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#e3f2fd',
                            borderRadius: '4px',
                            fontSize: '0.875rem'
                          }}>
                            {config.value_type}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {formatValue(config.current_value, config.value_type)}
                        </td>
                        <td style={{ padding: '0.75rem', color: '#666', fontSize: '0.875rem' }}>
                          {new Date(config.updated_at).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          <button
                            onClick={() => window.location.href = `/dashboard/configs/${config.id}`}
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
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
