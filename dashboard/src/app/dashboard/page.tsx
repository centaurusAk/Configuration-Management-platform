'use client';

import { DashboardLayout } from '../../components/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <h1 style={{ marginTop: 0 }}>Dashboard</h1>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '1.5rem', 
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2>Welcome, {user?.email}!</h2>
        <p>Organization: {user?.organizationName}</p>
        <p>Role: {user?.role}</p>
        
        <div style={{ marginTop: '2rem' }}>
          <h3>Quick Actions</h3>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <a 
              href="/dashboard/configs"
              style={{
                padding: '1rem',
                backgroundColor: '#1976d2',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px'
              }}
            >
              Manage Configurations
            </a>
            <a 
              href="/dashboard/rules"
              style={{
                padding: '1rem',
                backgroundColor: '#1976d2',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px'
              }}
            >
              Manage Rules
            </a>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
