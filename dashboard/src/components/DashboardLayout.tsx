'use client';

import { Sidebar } from './Sidebar';
import { ProtectedRoute } from './ProtectedRoute';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div style={{ display: 'flex', height: '100vh' }}>
        <Sidebar />
        <main style={{ 
          flex: 1, 
          overflow: 'auto',
          backgroundColor: '#f8fafc',
          padding: '2rem'
        }}>
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}
