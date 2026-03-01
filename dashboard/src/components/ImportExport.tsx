'use client';

import { useState } from 'react';
import { apiClient } from '../lib/api';

interface ImportExportProps {
  projectId: string;
  environmentId: string;
  onImportComplete?: () => void;
}

export function ImportExport({ projectId, environmentId, onImportComplete }: ImportExportProps) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      setExporting(true);
      setError(null);
      
      const data = await apiClient.exportConfigs(projectId, environmentId);
      
      // Create a blob and download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `configs-${projectId}-${environmentId}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to export configurations');
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportPreview(null);
      setImportResult(null);
      setError(null);
      
      // Read and parse the file for preview
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          setImportPreview(json);
        } catch (err) {
          setError('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleImport = async () => {
    if (!importPreview) {
      setError('Please select a valid JSON file');
      return;
    }
    
    try {
      setImporting(true);
      setError(null);
      
      const result = await apiClient.importConfigs(importPreview);
      setImportResult(result);
      setImportFile(null);
      setImportPreview(null);
      
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to import configurations');
    } finally {
      setImporting(false);
    }
  };

  const handleCancelImport = () => {
    setImportFile(null);
    setImportPreview(null);
    setImportResult(null);
    setError(null);
  };

  return (
    <div style={{ 
      backgroundColor: 'white', 
      padding: '1.5rem', 
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      marginBottom: '1.5rem'
    }}>
      <h2 style={{ marginTop: 0, fontSize: '1.25rem' }}>Import / Export</h2>
      
      {error && (
        <div style={{
          backgroundColor: '#fee2e2',
          border: '1px solid #ef4444',
          borderRadius: '4px',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#991b1b' }}>
            {error}
          </p>
        </div>
      )}

      {/* Export Section */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Export Configurations</h3>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          Download all configurations and rules for this project and environment as a JSON file.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: exporting ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: exporting ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500
          }}
        >
          {exporting ? 'Exporting...' : 'Export to JSON'}
        </button>
      </div>

      {/* Import Section */}
      <div>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Import Configurations</h3>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          Upload a JSON file to import configurations and rules. Existing configurations will be updated.
        </p>
        
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            style={{
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '0.875rem',
              width: '100%'
            }}
          />
        </div>

        {/* Import Preview */}
        {importPreview && !importResult && (
          <div style={{
            backgroundColor: '#f9fafb',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <h4 style={{ marginTop: 0, fontSize: '0.875rem', fontWeight: 600 }}>Import Preview</h4>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              <p style={{ margin: '0.25rem 0' }}>
                Configurations: {importPreview.configs?.length || 0}
              </p>
              <p style={{ margin: '0.25rem 0' }}>
                Rules: {importPreview.rules?.length || 0}
              </p>
            </div>
            
            <details style={{ marginTop: '1rem' }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
                View Full JSON
              </summary>
              <pre style={{
                marginTop: '0.5rem',
                padding: '0.5rem',
                backgroundColor: '#1f2937',
                color: '#f9fafb',
                borderRadius: '4px',
                fontSize: '0.75rem',
                overflow: 'auto',
                maxHeight: '300px'
              }}>
                {JSON.stringify(importPreview, null, 2)}
              </pre>
            </details>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                onClick={handleImport}
                disabled={importing}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: importing ? '#9ca3af' : '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: importing ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500
                }}
              >
                {importing ? 'Importing...' : 'Confirm Import'}
              </button>
              <button
                onClick={handleCancelImport}
                disabled={importing}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: importing ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Import Result */}
        {importResult && (
          <div style={{
            backgroundColor: '#d1fae5',
            border: '1px solid #059669',
            borderRadius: '4px',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <h4 style={{ marginTop: 0, fontSize: '0.875rem', fontWeight: 600, color: '#065f46' }}>
              Import Successful!
            </h4>
            <div style={{ fontSize: '0.875rem', color: '#065f46' }}>
              <p style={{ margin: '0.25rem 0' }}>
                Created: {importResult.created || 0} configurations
              </p>
              <p style={{ margin: '0.25rem 0' }}>
                Updated: {importResult.updated || 0} configurations
              </p>
              <p style={{ margin: '0.25rem 0' }}>
                Rules imported: {importResult.rulesImported || 0}
              </p>
            </div>
            <button
              onClick={handleCancelImport}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#059669',
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
        )}
      </div>
    </div>
  );
}
