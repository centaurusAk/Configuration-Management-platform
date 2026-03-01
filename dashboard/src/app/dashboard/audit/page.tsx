'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { apiClient } from '../../../lib/api';

interface AuditLog {
  id: string;
  timestamp: string;
  user_id: string;
  organization_id: string;
  action_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'ROLLBACK';
  resource_type: 'CONFIG_KEY' | 'CONFIG_VERSION' | 'RULE' | 'API_KEY' | 'USER';
  resource_id: string;
  old_value?: any;
  new_value?: any;
  metadata?: Record<string, any>;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [userId, setUserId] = useState('');
  const [actionType, setActionType] = useState('');
  const [resourceType, setResourceType] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filters: any = {
        limit,
        offset: (page - 1) * limit,
      };
      
      if (startDate && endDate) {
        filters.dateRange = { start: startDate, end: endDate };
      }
      if (userId) filters.userId = userId;
      if (actionType) filters.actionType = actionType;
      if (resourceType) filters.resourceType = resourceType;
      
      const response = await apiClient.getAuditLogs(filters);
      setLogs(response.logs || []);
      setTotalPages(Math.ceil((response.total || 0) / limit));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const handleFilter = () => {
    setPage(1);
    fetchLogs();
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setUserId('');
    setActionType('');
    setResourceType('');
    setPage(1);
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  return (
    <DashboardLayout>
      <h1 style={{ marginTop: 0 }}>Audit Logs</h1>
      
      {/* Filters */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '1.5rem', 
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '1.5rem'
      }}>
        <h2 style={{ marginTop: 0, fontSize: '1.25rem' }}>Filters</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label htmlFor="start-date" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
              Start Date
            </label>
            <input
              id="start-date"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '0.875rem'
              }}
            />
          </div>
          
          <div>
            <label htmlFor="end-date" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
              End Date
            </label>
            <input
              id="end-date"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '0.875rem'
              }}
            />
          </div>
          
          <div>
            <label htmlFor="user-id" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
              User ID
            </label>
            <input
              id="user-id"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Filter by user ID"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '0.875rem'
              }}
            />
          </div>
          
          <div>
            <label htmlFor="action-type" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
              Action Type
            </label>
            <select
              id="action-type"
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '0.875rem'
              }}
            >
              <option value="">All Actions</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="ROLLBACK">ROLLBACK</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="resource-type" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
              Resource Type
            </label>
            <select
              id="resource-type"
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '0.875rem'
              }}
            >
              <option value="">All Resources</option>
              <option value="CONFIG_KEY">CONFIG_KEY</option>
              <option value="CONFIG_VERSION">CONFIG_VERSION</option>
              <option value="RULE">RULE</option>
              <option value="API_KEY">API_KEY</option>
              <option value="USER">USER</option>
            </select>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleFilter}
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
            Apply Filters
          </button>
          <button
            onClick={handleClearFilters}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500
            }}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '1.5rem', 
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        {loading && <p>Loading audit logs...</p>}
        {error && <p style={{ color: '#ef4444' }}>{error}</p>}
        
        {!loading && !error && logs.length === 0 && (
          <p>No audit logs found.</p>
        )}
        
        {!loading && !error && logs.length > 0 && (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Timestamp</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>User ID</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Action</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Resource</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Resource ID</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Old Value</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>New Value</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.75rem' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem' }}>{log.user_id}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          backgroundColor: 
                            log.action_type === 'CREATE' ? '#dbeafe' :
                            log.action_type === 'UPDATE' ? '#fef3c7' :
                            log.action_type === 'DELETE' ? '#fee2e2' :
                            '#e0e7ff',
                          color:
                            log.action_type === 'CREATE' ? '#1e40af' :
                            log.action_type === 'UPDATE' ? '#92400e' :
                            log.action_type === 'DELETE' ? '#991b1b' :
                            '#3730a3'
                        }}>
                          {log.action_type}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>{log.resource_type}</td>
                      <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {log.resource_id.substring(0, 8)}...
                      </td>
                      <td style={{ padding: '0.75rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <pre style={{ margin: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {formatValue(log.old_value)}
                        </pre>
                      </td>
                      <td style={{ padding: '0.75rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <pre style={{ margin: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {formatValue(log.new_value)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Page {page} of {totalPages}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: page === 1 ? '#e5e7eb' : '#3b82f6',
                    color: page === 1 ? '#9ca3af' : 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: page === totalPages ? '#e5e7eb' : '#3b82f6',
                    color: page === totalPages ? '#9ca3af' : 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: page === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
