'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '../../../../components/DashboardLayout';
import { apiClient } from '../../../../lib/api';

interface Project {
  id: string;
  name: string;
}

interface Environment {
  id: string;
  name: string;
}

export default function NewConfigPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedEnvironment, setSelectedEnvironment] = useState('');

  const [keyName, setKeyName] = useState('');
  const [valueType, setValueType] = useState<'boolean' | 'string' | 'number' | 'json'>('boolean');
  const [defaultValue, setDefaultValue] = useState<any>(true);
  const [jsonInput, setJsonInput] = useState('{}');

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadEnvironments(selectedProject);
    }
  }, [selectedProject]);

  // Reset default value when type changes
  useEffect(() => {
    switch (valueType) {
      case 'boolean':
        setDefaultValue(true);
        break;
      case 'string':
        setDefaultValue('');
        break;
      case 'number':
        setDefaultValue(0);
        break;
      case 'json':
        setDefaultValue({});
        setJsonInput('{}');
        break;
    }
  }, [valueType]);

  const loadProjects = async () => {
    try {
      const data = await apiClient.getProjects();
      setProjects(data);
      if (data.length > 0) setSelectedProject(data[0].id);
    } catch (err: any) {
      console.error('Failed to load projects:', err);
    }
  };

  const loadEnvironments = async (projectId: string) => {
    try {
      const data = await apiClient.getEnvironments(projectId);
      setEnvironments(data);
      if (data.length > 0) setSelectedEnvironment(data[0].id);
    } catch (err: any) {
      console.error('Failed to load environments:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProject || !selectedEnvironment) {
      setError('Please select a project and environment');
      return;
    }
    if (!keyName.trim()) {
      setError('Key name is required');
      return;
    }

    let finalValue = defaultValue;

    if (valueType === 'json') {
      try {
        finalValue = JSON.parse(jsonInput);
      } catch {
        setError('Invalid JSON format');
        return;
      }
    }

    if (valueType === 'number') {
      finalValue = Number(defaultValue);
      if (isNaN(finalValue)) {
        setError('Default value must be a valid number');
        return;
      }
    }

    try {
      setCreating(true);
      await apiClient.createConfig({
        projectId: selectedProject,
        environmentId: selectedEnvironment,
        keyName: keyName.trim(),
        valueType,
        defaultValue: finalValue,
      });
      router.push('/dashboard/configs');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to create configuration');
    } finally {
      setCreating(false);
    }
  };

  const renderDefaultValueInput = () => {
    switch (valueType) {
      case 'boolean':
        return (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="boolVal"
                checked={defaultValue === true}
                onChange={() => setDefaultValue(true)}
              />
              True
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="boolVal"
                checked={defaultValue === false}
                onChange={() => setDefaultValue(false)}
              />
              False
            </label>
          </div>
        );
      case 'string':
        return (
          <input
            type="text"
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.target.value)}
            placeholder="Enter default string value"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '0.875rem',
            }}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.target.value)}
            placeholder="Enter default number"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '0.875rem',
            }}
          />
        );
      case 'json':
        return (
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='{"key": "value"}'
            rows={6}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontFamily: 'monospace',
              resize: 'vertical',
            }}
          />
        );
    }
  };

  return (
    <DashboardLayout>
      <div>
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => router.back()}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              color: '#666',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '1rem',
            }}
          >
            ← Back
          </button>
          <h1 style={{ margin: 0 }}>New Configuration</h1>
        </div>

        <div
          style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            maxWidth: '600px',
          }}
        >
          <form onSubmit={handleSubmit}>
            {/* Project */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
                Project *
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Environment */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
                Environment *
              </label>
              <select
                value={selectedEnvironment}
                onChange={(e) => setSelectedEnvironment(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                }}
              >
                {environments.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Key Name */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
                Key Name *
              </label>
              <input
                type="text"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g. feature.dark_mode.enabled"
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                }}
              />
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#666' }}>
                Use dot notation for namespacing (e.g. feature.name.property)
              </p>
            </div>

            {/* Value Type */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
                Value Type *
              </label>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {(['boolean', 'string', 'number', 'json'] as const).map((type) => (
                  <label
                    key={type}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      padding: '0.5rem 1rem',
                      border: valueType === type ? '2px solid #1976d2' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      backgroundColor: valueType === type ? '#e3f2fd' : 'white',
                      fontSize: '0.875rem',
                      fontWeight: valueType === type ? 600 : 400,
                    }}
                  >
                    <input
                      type="radio"
                      name="valueType"
                      value={type}
                      checked={valueType === type}
                      onChange={() => setValueType(type)}
                      style={{ display: 'none' }}
                    />
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            {/* Default Value */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
                Default Value *
              </label>
              {renderDefaultValueInput()}
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  color: '#b91c1c',
                  marginBottom: '1.25rem',
                  fontSize: '0.875rem',
                }}
              >
                {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="submit"
                disabled={creating}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: creating ? '#93c5fd' : '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: creating ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                {creating ? 'Creating...' : 'Create Configuration'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/configs')}
                disabled={creating}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'transparent',
                  color: '#666',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
